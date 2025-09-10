import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { deleteTokens } from '../_shared/token_provider_v2.ts';

// CORS helper - updated for new domain
const ALLOW_ORIGINS = new Set([
  "https://photo-label-studio.lovable.app",                    // novo domínio publicado
  "https://a4888df3-b048-425b-8000-021ee0970cd7.sandbox.lovable.dev", // sandbox
  "https://lovable.dev",                                       // editor (se necessário)
  "http://localhost:3000",
  "http://localhost:5173",
]);

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin");
  const allowed = origin && ALLOW_ORIGINS.has(origin) ? origin : "";
  
  return {
    "Access-Control-Allow-Origin": allowed || "https://photo-label-studio.lovable.app",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Vary": "Origin",
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