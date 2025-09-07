import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders
    },
  });

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  
  try {
    console.log('🔍 DIAG SCOPES: Starting tokeninfo check');
    
    const { user_id } = (await req.json().catch(() => ({}))) as { user_id?: string };
    if (!user_id) {
      console.log('❌ DIAG SCOPES: Missing user_id');
      return json(400, { status: 400, reason: "MISSING_USER_ID" });
    }

    console.log('🔍 DIAG SCOPES: Checking for user:', user_id);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Pegue tokens de forma segura
    console.log('🔍 DIAG SCOPES: Fetching tokens via RPC');
    const { data, error } = await supabase.rpc("get_google_drive_tokens_secure", { p_user_id: user_id });
    
    if (error) {
      console.error('❌ DIAG SCOPES: RPC error:', error);
      return json(500, { status: 500, reason: "RPC_ERROR", details: error.message });
    }
    
    if (!data || data.length === 0) {
      console.log('❌ DIAG SCOPES: No tokens found');
      return json(400, { status: 400, reason: "NO_TOKENS_FOUND" });
    }

    const tokenData = data[0];
    const access_token = tokenData.access_token;
    
    if (!access_token) {
      console.log('❌ DIAG SCOPES: No access token in result');
      return json(400, { status: 400, reason: "NO_ACCESS_TOKEN" });
    }

    console.log('🔍 DIAG SCOPES: Calling Google tokeninfo endpoint');
    const resp = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(access_token)}`,
    );

    console.log('🔍 DIAG SCOPES: Google response status:', resp.status);
    
    if (resp.status === 401) {
      return json(401, { status: 401, reason: "INVALID_TOKEN" });
    }
    
    if (!resp.ok) {
      return json(resp.status, { status: resp.status, reason: "GOOGLE_API_ERROR" });
    }

    const body = await resp.json().catch(() => ({}));

    const scopes = body?.scope ? body.scope.split(' ') : [];
    const requiredScopes = [
      'https://www.googleapis.com/auth/drive.metadata.readonly',
      'https://www.googleapis.com/auth/drive.file'
    ];
    const hasRequiredScopes = requiredScopes.every(scope => scopes.includes(scope));

    console.log('✅ DIAG SCOPES: Complete - scopes found:', scopes.length);

    return json(200, {
      status: 200,
      scopes: body?.scope ?? null,
      expires_in: body?.expires_in ?? null,
      scopesList: scopes,
      hasRequiredScopes: hasRequiredScopes,
      requiredScopes: requiredScopes
    });
  } catch (e) {
    console.error("❌ DIAG SCOPES: Unexpected error", { msg: e?.message, name: e?.name });
    return json(500, { status: 500, reason: "INTERNAL_ERROR", note: "check function logs" });
  }
});