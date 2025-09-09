import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { deleteTokens } from '../_shared/token_provider_v2.ts';

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
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Vary": "Origin, Access-Control-Request-Headers",
  };
}

serve(async (req) => {
  console.log("🗑️ Google Drive Disconnect called");

  if (req.method === 'OPTIONS') {
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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return json(401, { error: 'MISSING_AUTH', message: 'Authorization header required' });
    }

    const jwt = authHeader.replace('Bearer ', '');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Use the JWT to authenticate and get user
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !user) {
      console.error("Auth error:", userError);
      return json(401, { error: "INVALID_JWT", details: userError });
    }

    console.log("🗑️ Disconnecting Google Drive for user:", user.id);

    // Delete all tokens for this user
    const result = await deleteTokens(user.id);
    
    return json(200, {
      status: "OK",
      message: "Google Drive connection removed",
      user_id: user.id,
      deleted_tokens: result
    });

  } catch (error: any) {
    console.error("Error in google-drive-disconnect:", error);
    return json(500, { error: "INTERNAL_ERROR", message: error.message });
  }
});