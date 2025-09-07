import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ensureAccessToken } from "../_shared/token_provider_v2.ts";

// Utility functions
const json = (s: number, b: unknown) => new Response(JSON.stringify(b), {
  status: s, 
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type, x-user-id",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
  }
});

serve(async (req) => {
  console.log("diag-scopes called");

  if (req.method === "OPTIONS") {
    return json(200, {});
  }

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