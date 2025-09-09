import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ensureAccessToken } from "../_shared/token_provider_v2.ts";

// Utility functions
const ALLOW_ORIGINS = new Set([
  "https://lovable.dev",
  "http://localhost:3000",
  "http://localhost:5173"
]);

function cors(origin: string | null) {
  const allowed = origin && ALLOW_ORIGINS.has(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allowed || "https://lovable.dev",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Vary": "Origin",
  };
}

serve(async (req) => {
  console.log("diag-scopes called");

  if (req.method === "OPTIONS") {
    return new Response(null, { 
      status: 204, 
      headers: cors(req.headers.get("origin")) 
    });
  }

  const json = (s: number, b: unknown) => new Response(JSON.stringify(b), {
    status: s,
    headers: {
      "Content-Type": "application/json",
      ...cors(req.headers.get("origin"))
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

    // Get access token with auto-refresh
    let accessToken;
    try {
      accessToken = await ensureAccessToken(user.id);
      console.log("Token obtained, length:", accessToken.length);
    } catch (error) {
      console.error("Token error:", error);
      return json(401, { error: "NO_TOKENS", message: error.message });
    }

    // Test tokeninfo to get current scopes
    const resp = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${accessToken}`);
    
    if (resp.status === 401) {
      // Force refresh and retry once
      console.log("401 - attempting refresh and retry...");
      try {
        const freshToken = await ensureAccessToken(user.id);
        const retryResp = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${freshToken}`);
        
        if (!retryResp.ok) {
          console.error("Retry tokeninfo failed:", retryResp.status, await retryResp.text());
          return json(retryResp.status, { 
            error: "INVALID_TOKEN_AFTER_REFRESH", 
            status: retryResp.status 
          });
        }
        
        const retryInfo = await retryResp.json();
        return json(200, {
          status: "OK",
          scopes: retryInfo.scope ? retryInfo.scope.split(" ") : [],
          expires_in: retryInfo.expires_in || "unknown",
          audience: retryInfo.aud || "unknown",
          retried: true
        });
      } catch (refreshError) {
        return json(401, { error: "REFRESH_FAILED", message: refreshError.message });
      }
    }
    
    if (!resp.ok) {
      console.error("Tokeninfo failed:", resp.status, await resp.text());
      return json(401, { error: "INVALID_TOKEN", status: resp.status });
    }

    const info = await resp.json();
    console.log("Token info received");

    return json(200, {
      status: "OK",
      scopes: info.scope ? info.scope.split(" ") : [],
      expires_in: info.expires_in || "unknown",
      audience: info.aud || "unknown"
    });

  } catch (error: any) {
    console.error("Error in diag-scopes:", error);
    return json(500, { error: "INTERNAL_ERROR", message: error.message });
  }
});