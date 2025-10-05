import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { signPayload } from "../_shared/signing.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { requireAuth, httpJson, safeError, getClientIp } from "../_shared/http.ts";
import { checkRateLimit, RATE_LIMITS } from "../_shared/rate-limit.ts";
import { GetThumbUrlsSchema, validateBody } from "../_shared/validation.ts";

serve(async (req) => {
  const preflightResponse = preflight(req);
  if (preflightResponse) return preflightResponse;

  if (req.method !== "POST") {
    return httpJson(405, { ok: false, error: "Method not allowed." });
  }

  try {
    // Authenticate user
    const { userId } = await requireAuth(req);
    
    // Rate limiting
    const clientIp = getClientIp(req);
    const canProceed = await checkRateLimit({
      userId,
      ip: clientIp,
      endpoint: "get-thumb-urls",
      limit: RATE_LIMITS["get-thumb-urls"].limit,
      windowSec: RATE_LIMITS["get-thumb-urls"].windowSec,
    });

    if (!canProceed) {
      return httpJson(429, { ok: false, error: "Rate limit exceeded. Please try again later." });
    }

    // Validate input
    const body = await req.json().catch(() => ({}));
    const { fileIds } = validateBody(GetThumbUrlsSchema, body);
    const base = Deno.env.get("SUPABASE_URL")!.replace(/\/$/, "");
    const ttlSec = 3600; // 1 hour TTL
    const exp = Math.floor(Date.now() / 1000) + ttlSec;

    const urls: Record<string, string> = {};
    for (const id of fileIds) {
      // Generate random nonce (16 bytes = 32 hex chars)
      const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      const sig = await signPayload({ uid: userId, fileId: id, exp, nonce });
      urls[id] = `${base}/functions/v1/thumb-open?sig=${encodeURIComponent(sig)}`;
    }

    return httpJson(200, { ok: true, ttlSec, urls });

  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return httpJson(401, { ok: false, error: "Unauthorized." });
    }
    if (error?.message === "VALIDATION_FAILED") {
      return httpJson(400, { ok: false, error: "Invalid request data." });
    }
    return safeError(error, { 
      publicMessage: "Unable to generate thumbnail URLs.", 
      logContext: "get-thumb-urls" 
    });
  }
});