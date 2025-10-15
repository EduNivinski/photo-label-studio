import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { requireAuth, httpJson, safeError, getClientIp } from "../_shared/http.ts";
import { checkRateLimit, RATE_LIMITS } from "../_shared/rate-limit.ts";
import { ensureAccessToken } from "../_shared/token_provider_v2.ts";

// CORS helper
const DEFAULT_ALLOWED = [
  "https://photo-label-studio.lovable.app",
  "http://localhost:3000",
  "http://localhost:5173",
];
const ALLOW = new Set(
  (Deno.env.get("CORS_ALLOWED_ORIGINS")?.split(",") ?? DEFAULT_ALLOWED)
    .map(s => s.trim()).filter(Boolean)
);

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin");
  const allowed = origin && ALLOW.has(origin) ? origin : "https://photo-label-studio.lovable.app";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, cache-control, x-client-info, x-supabase-authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  } as const;
}

const VerifyFolderSchema = z.object({
  folderId: z.string().min(5).max(256),
});

// Helper to extract user email from token (via Google's tokeninfo)
async function getUserEmailFromToken(accessToken: string): Promise<string | null> {
  try {
    const resp = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${accessToken}`);
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.email || null;
  } catch {
    return null;
  }
}

async function handleVerify(userId: string, folderId: string) {
  const traceId = crypto.randomUUID();
  
  console.log("[folder-verify][start]", {
    traceId,
    user_id: userId,
    incomingFolderId: folderId
  });

  try {
    // Get access token
    let accessToken: string;
    try {
      accessToken = await ensureAccessToken(userId);
    } catch (e: any) {
      console.error("[folder-verify][token-failed]", { traceId, error: e.message });
      return httpJson(200, {
        ok: false,
        traceId,
        reason: "TOKEN_UNAVAILABLE",
        error: e.message
      });
    }

    // Get user email from token
    const userEmail = await getUserEmailFromToken(accessToken) || "unknown";
    
    console.log("[folder-verify][user-context]", {
      traceId,
      user_id: userId,
      userEmail
    });

    // Lookup folder with supportsAllDrives
    const metaUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?` +
      `fields=id,name,mimeType,trashed,parents,driveId,owners(emailAddress),shortcutDetails&supportsAllDrives=true`;
    
    console.log("[folder-verify][lookup-request]", {
      traceId,
      user_id: userId,
      userEmail,
      incomingFolderId: folderId,
      request: { supportsAllDrives: true }
    });

    const metaResp = await fetch(metaUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const httpStatus = metaResp.status;
    let googleError: any = null;
    let resolved: any = null;

    if (!metaResp.ok) {
      googleError = await metaResp.json().catch(() => ({}));
      
      console.log("[folder-verify]", {
        traceId,
        user_id: userId,
        userEmail,
        incomingFolderId: folderId,
        httpStatus,
        reason: googleError?.error?.message || "UNKNOWN",
        googleErrorCode: googleError?.error?.errors?.[0]?.reason || null
      });

      return httpJson(200, {
        ok: false,
        traceId,
        userEmail,
        accountHint: userId,
        lookup: {
          incomingFolderId: folderId,
          httpStatus,
          googleError,
          resolved: null
        }
      });
    }

    // Success - parse metadata
    let meta = await metaResp.json();
    let isShortcut = false;
    let resolvedId = meta.id;

    // Resolve shortcut if needed
    if (meta.mimeType === "application/vnd.google-apps.shortcut") {
      isShortcut = true;
      const targetId = meta.shortcutDetails?.targetId;
      
      if (targetId) {
        console.log("[folder-verify][resolving-shortcut]", {
          traceId,
          shortcutId: folderId,
          targetId
        });

        // Fetch target
        const targetUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(targetId)}?` +
          `fields=id,name,mimeType,trashed,parents,driveId,owners(emailAddress)&supportsAllDrives=true`;
        
        const targetResp = await fetch(targetUrl, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });

        if (targetResp.ok) {
          meta = await targetResp.json();
          resolvedId = meta.id;
        }
      }
    }

    resolved = {
      id: resolvedId,
      name: meta.name,
      mimeType: meta.mimeType,
      trashed: meta.trashed || false,
      driveId: meta.driveId || null,
      isShortcut,
      owners: meta.owners || []
    };

    console.log("[folder-verify]", {
      traceId,
      user_id: userId,
      userEmail,
      incomingFolderId: folderId,
      httpStatus: 200,
      reason: "SUCCESS",
      isShortcut,
      resolvedId,
      driveId: meta.driveId || null
    });

    return httpJson(200, {
      ok: true,
      traceId,
      userEmail,
      accountHint: userId,
      lookup: {
        incomingFolderId: folderId,
        httpStatus: 200,
        googleError: null,
        resolved
      }
    });

  } catch (err: any) {
    console.error("[folder-verify][error]", {
      traceId,
      user_id: userId,
      error: err?.message || String(err)
    });

    return httpJson(200, {
      ok: false,
      traceId,
      reason: "INTERNAL_ERROR",
      error: err?.message || "Unknown error"
    });
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  try {
    // Support both GET and POST
    if (req.method !== "GET" && req.method !== "POST") {
      throw new Error("METHOD_NOT_ALLOWED");
    }

    // Authenticate user
    const { userId } = await requireAuth(req);

    // Rate limiting
    const clientIp = getClientIp(req);
    const canProceed = await checkRateLimit({
      userId,
      ip: clientIp,
      endpoint: "drive-folder-verify",
      limit: RATE_LIMITS["google-drive-auth"]?.limit || 100,
      windowSec: RATE_LIMITS["google-drive-auth"]?.windowSec || 60,
    });

    if (!canProceed) {
      return httpJson(429, { ok: false, error: "Rate limit exceeded. Please try again later." });
    }

    // Parse folderId from query params (GET) or body (POST)
    let folderId: string;
    
    if (req.method === "GET") {
      const url = new URL(req.url);
      folderId = url.searchParams.get("folderId") || "";
    } else {
      const body = await req.json().catch(() => ({}));
      folderId = body.folderId || "";
    }

    // Validate
    const parsed = VerifyFolderSchema.safeParse({ folderId });
    if (!parsed.success) {
      return httpJson(400, { 
        ok: false, 
        error: "Invalid folderId parameter",
        details: parsed.error.errors
      });
    }

    return await handleVerify(userId, parsed.data.folderId);

  } catch (err: any) {
    console.error("[drive-folder-verify] Error:", {
      message: err?.message || "UNKNOWN",
      stack: err?.stack
    });
    
    if (err?.message === "UNAUTHORIZED") {
      return httpJson(401, { ok: false, error: "Unauthorized." });
    }
    
    return safeError(err, { 
      publicMessage: "Unable to verify folder.",
      logContext: "drive-folder-verify"
    });
  }
});
