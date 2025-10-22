import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { requireAuth } from "../_shared/http.ts";
import { ensureAccessToken } from "../_shared/token_provider_v2.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://photo-label-studio.lovable.app',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, cache-control, x-client-info, apikey',
  'Access-Control-Max-Age': '86400',
  'Cache-Control': 'no-store',
};

function jsonResponse(status: number, body: any): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    }
  });
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const traceId = crypto.randomUUID();
  console.log('[drive-debug-scopes][start]', { traceId, method: req.method });

  try {
    // Authenticate user
    const { userId } = await requireAuth(req);
    console.log('[drive-debug-scopes][auth]', { traceId, userId });

    // Get access token (this will automatically refresh if needed)
    let accessToken: string;
    let scopes: string[] = [];
    let hasDriveReadonly = false;
    let tokenError = null;

    try {
      accessToken = await ensureAccessToken(userId);

      // Query Google's tokeninfo endpoint to get granted scopes
      const tokenInfoResp = await fetch(
        `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${accessToken}`
      );

      if (tokenInfoResp.ok) {
        const tokenInfo = await tokenInfoResp.json();
        const scopeString = tokenInfo.scope || '';
        scopes = scopeString.split(' ').filter(Boolean);
        hasDriveReadonly = scopes.some(s => 
          s.includes('drive.readonly') || s.includes('drive')
        );
      } else {
        tokenError = `Token info failed: ${tokenInfoResp.status}`;
      }
    } catch (err: any) {
      tokenError = String(err?.message || err);
      console.log('[drive-debug-scopes][token-error]', { traceId, error: tokenError });
    }

    console.log('[drive-debug-scopes][success]', { 
      traceId, 
      userId, 
      scopeCount: scopes.length,
      hasDriveReadonly 
    });

    return jsonResponse(200, {
      ok: true,
      scopes,
      hasDriveReadonly,
      scopeCount: scopes.length,
      tokenError,
      traceId
    });

  } catch (err: any) {
    console.log('[drive-debug-scopes][error]', { 
      traceId, 
      code: 'UNEXPECTED_ERROR', 
      error: String(err) 
    });

    if (err?.message === "UNAUTHORIZED") {
      return jsonResponse(401, { 
        ok: false, 
        code: "UNAUTHORIZED", 
        traceId 
      });
    }

    return jsonResponse(500, {
      ok: false,
      code: "UNEXPECTED_ERROR",
      message: String(err),
      traceId
    });
  }
});
