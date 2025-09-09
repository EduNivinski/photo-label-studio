import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { deleteTokens } from '../_shared/token_provider_v2.ts';

const ALLOW_ORIGINS = new Set([
  "https://lovable.dev",
  "http://localhost:3000",
  "http://localhost:5173"
]);

function cors(origin: string | null) {
  const allowed = origin && ALLOW_ORIGINS.has(origin) ? origin : "https://lovable.dev";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Vary": "Origin",
  };
}

serve(async (req) => {
  console.log("🗑️ Google Drive Disconnect called");

  if (req.method === 'OPTIONS') {
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