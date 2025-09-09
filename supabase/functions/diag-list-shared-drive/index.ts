import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ensureAccessToken } from "../_shared/token_provider_v2.ts";

// CORS helper — aceitar sandbox do Lovable + localhost
function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  let allowOrigin = "";

  try {
    const u = new URL(origin);
    const isLovableRoot     = u.origin === "https://lovable.dev";
    const isLovableSandbox  = u.hostname.endsWith(".sandbox.lovable.dev");
    const isLocal3000       = u.origin === "http://localhost:3000";
    const isLocal5173       = u.origin === "http://localhost:5173";

    if (isLovableRoot || isLovableSandbox || isLocal3000 || isLocal5173) {
      allowOrigin = origin; // ecoa exatamente o origin da página
    }
  } catch { /* ignore */ }

  // Ecoa os headers solicitados no preflight (robusto)
  const reqHeaders = req.headers.get("access-control-request-headers");
  const allowHeaders = (reqHeaders && reqHeaders.trim().length > 0)
    ? reqHeaders
    : "authorization, content-type, apikey, x-client-info";

  return {
    "Access-Control-Allow-Origin": allowOrigin || "https://lovable.dev",
    "Access-Control-Allow-Headers": allowHeaders,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Vary": "Origin, Access-Control-Request-Headers",
  };
}

serve(async (req) => {
  console.log("diag-list-shared-drive called");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  const json = (s: number, b: unknown) => new Response(JSON.stringify(b), {
    status: s,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(req)
    }
  });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return json(401, { error: "MISSING_AUTH" });
    }

    const jwt = authHeader.replace("Bearer ", "");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !user) {
      console.error("Auth error:", userError);
      return json(401, { error: "INVALID_JWT", details: userError });
    }

    console.log("User authenticated:", user.id);

    // Get shared drive ID from query params
    const url = new URL(req.url);
    const driveId = url.searchParams.get("driveId");
    
    if (!driveId) {
      return json(400, { error: "MISSING_DRIVE_ID" });
    }

    console.log("Listing shared drive:", driveId);

    // Get access token with auto-refresh
    let accessToken;
    try {
      accessToken = await ensureAccessToken(user.id);
      console.log("Token obtained, length:", accessToken.length);
    } catch (error) {
      console.error("Token error:", error);
      return json(401, { error: "NO_TOKENS", message: error.message });
    }

    // Build query for shared drive contents
    const params = new URLSearchParams({
      q: "trashed=false",
      fields: "nextPageToken,files(id,name,mimeType,parents,modifiedTime,shortcutDetails)",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
      corpora: "drive",
      driveId: driveId,
      pageSize: "100",
    });

    console.log("API URL:", `https://www.googleapis.com/drive/v3/files?${params.toString()}`);

    const resp = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    console.log("Response status:", resp.status);

    if (resp.status === 401) {
      // Force refresh and retry once
      console.log("401 - attempting refresh and retry...");
      try {
        const freshToken = await ensureAccessToken(user.id);
        const retryResp = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
          headers: { Authorization: `Bearer ${freshToken}` }
        });
        
        if (!retryResp.ok) {
          return json(retryResp.status, { 
            status: retryResp.status, 
            reason: "UNAUTHORIZED_AFTER_REFRESH" 
          });
        }
        
        const retryData = await retryResp.json();
        return json(200, {
          status: "OK",
          driveId: driveId,
          items: retryData.files || [],
          echo: { corpora: "drive", driveId: driveId },
          retried: true
        });
      } catch (refreshError) {
        return json(401, { error: "REFRESH_FAILED", message: refreshError.message });
      }
    }

    if (!resp.ok) {
      const errorText = await resp.text();
      console.error("API error:", errorText);
      return json(resp.status, { status: resp.status, reason: errorText });
    }

    const data = await resp.json();
    return json(200, {
      status: "OK",
      driveId: driveId,
      items: data.files || [],
      echo: { corpora: "drive", driveId: driveId }
    });

  } catch (error: any) {
    console.error("Error in diag-list-shared-drive:", error);
    return json(500, { error: "INTERNAL_ERROR", message: error.message });
  }
});