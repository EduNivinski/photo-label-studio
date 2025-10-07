import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { httpJson, safeError, getClientIp } from "../_shared/http.ts";
import { checkRateLimit, RATE_LIMITS } from "../_shared/rate-limit.ts";

const ORIGIN = "https://photo-label-studio.lovable.app";
const LEGACY_SUPPORT_UNTIL = new Date("2025-10-12").getTime(); // 7 days from now

function cors() {
  return { "Access-Control-Allow-Origin": ORIGIN };
}

function admin() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

// Verify signature with constant-time comparison
async function verifyPayloadSecure(sig: string): Promise<{ uid: string; fileId: string; exp?: number; nonce?: string; isLegacy: boolean }> {
  const RAW_KEY = Deno.env.get("THUMB_SIGNING_KEY");
  if (!RAW_KEY) throw new Error("ENV_MISSING_THUMB_SIGNING_KEY");
  
  const [p, m] = sig.split(".");
  if (!p || !m) throw new Error("BAD_SIG");
  
  const payload = Uint8Array.from(atob(p.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
  const macRecv = Uint8Array.from(atob(m.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
  
  const key = new TextEncoder().encode(RAW_KEY);
  const mac = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
    .then(k => crypto.subtle.sign("HMAC", k, payload))
    .then(buf => new Uint8Array(buf));
  
  // Constant-time comparison
  if (mac.length !== macRecv.length || !mac.every((b, i) => b === macRecv[i])) {
    throw new Error("BAD_SIG");
  }
  
  const obj = JSON.parse(new TextDecoder().decode(payload));
  if (!obj || typeof obj !== "object") throw new Error("BAD_PAYLOAD");
  
  const isLegacy = !obj.exp || !obj.nonce;
  
  // Check expiration
  if (obj.exp) {
    const now = Math.floor(Date.now() / 1000);
    if (now > obj.exp) throw new Error("EXPIRED");
  }
  
  return { 
    uid: obj.uid, 
    fileId: obj.fileId, 
    exp: obj.exp, 
    nonce: obj.nonce,
    isLegacy 
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { 
      status: 204, 
      headers: {
        "Access-Control-Allow-Origin": ORIGIN,
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "content-type"
      } 
    });
  }

  try {
    const url = new URL(req.url);
    const sig = url.searchParams.get("sig") || "";
    const { uid, fileId, isLegacy, nonce } = await verifyPayloadSecure(sig);

    // Rate limiting (using IP since this is a public endpoint)
    const clientIp = getClientIp(req);
    try {
      await checkRateLimit({
        userId: uid,
        ip: clientIp,
        endpoint: "thumb-open",
        limit: RATE_LIMITS["thumb-open"].limit,
        windowSec: RATE_LIMITS["thumb-open"].windowSec,
      });
    } catch (e: any) {
      if (e?.message === "RATE_LIMITED") {
        return httpJson(429, { ok: false, error: "Rate limit exceeded." });
      }
      // RATE_LIMIT_UNAVAILABLE or other errors
      return httpJson(503, { ok: false, error: "Service temporarily unavailable." });
    }

    // Check if legacy signature support has ended
    if (isLegacy && Date.now() > LEGACY_SUPPORT_UNTIL) {
      return httpJson(410, { 
        ok: false, 
        error: "Legacy signature format no longer supported. Please refresh." 
      });
    }

    // Handle legacy signatures with TTL tracking
    if (isLegacy) {
      const { data: firstSeen, error: legacyError } = await admin().rpc("security.legacy_sig_first_seen", { 
        p_sig: sig 
      });
      if (legacyError) {
        console.error("[LEGACY_SIG_RPC_ERROR]", legacyError);
        throw new Error("LEGACY_SIG_UNAVAILABLE");
      }

      const ttlMs = 3600 * 1000; // 1 hour
      const firstSeenTime = new Date(firstSeen).getTime();
      if (Date.now() > firstSeenTime + ttlMs) {
        return httpJson(410, { 
          ok: false, 
          error: "Signature expired. Please refresh." 
        });
      }
    }

    // Verify nonce (replay protection) for non-legacy signatures
    if (!isLegacy && nonce) {
      const { data: isValid, error: nonceError } = await admin().rpc("security.consume_nonce_once", { 
        p_nonce: nonce 
      });
      if (nonceError) {
        console.error("[NONCE_RPC_ERROR]", nonceError);
        throw new Error("NONCE_UNAVAILABLE");
      }
      if (!isValid) {
        console.error(`Replay attempt detected: nonce=${nonce}, uid=${uid}`);
        throw new Error("REPLAY");
      }
    }

    // Validate user exists
    const { data: u } = await admin().auth.admin.getUserById(uid);
    if (!u?.user?.id) throw new Error("BAD_UID");

    // Get access token
    const { ensureAccessToken } = await import("../_shared/token_provider_v2.ts");
    const accessToken = await ensureAccessToken(uid);

    const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=thumbnailLink&supportsAllDrives=true`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const meta = await metaRes.json().catch(()=> ({}));
    if (!metaRes.ok || !meta?.thumbnailLink) {
      return httpJson(404, { ok: false, error: "Thumbnail not available." });
    }

    const imgRes = await fetch(meta.thumbnailLink);
    if (!imgRes.ok) {
      return httpJson(502, { ok: false, error: "Unable to fetch thumbnail." });
    }

    const buf = new Uint8Array(await imgRes.arrayBuffer());
    const type = imgRes.headers.get("content-type") || "image/jpeg";
    
    const headers: Record<string, string> = { 
      "Content-Type": type, 
      "Cache-Control": "public, max-age=60",
      "Access-Control-Allow-Origin": ORIGIN
    };

    // Add deprecation headers for legacy signatures
    if (isLegacy) {
      headers["Deprecation"] = "true";
      // Shorten remaining window to 2 days instead of full 7 days
      headers["Sunset"] = new Date(Date.now() + 2 * 24 * 3600 * 1000).toUTCString();
      console.warn(`Legacy signature used: uid=${uid}, fileId=${fileId}`);
    }

    return new Response(buf, { status: 200, headers });

  } catch (e: any) {
    const msg = e?.message || String(e);
    const isSig = /BAD_SIG|BAD_PAYLOAD|EXPIRED|ENV_MISSING_THUMB_SIGNING_KEY|BAD_UID/.test(msg);
    const isReplay = msg === "REPLAY";
    
    if (isReplay) {
      return httpJson(403, { ok: false, error: "Request already processed." });
    }
    
    if (isSig) {
      return httpJson(401, { ok: false, error: "Unauthorized." });
    }
    
    return safeError(e, { 
      publicMessage: "Unable to load thumbnail.", 
      logContext: "thumb-open" 
    });
  }
});