import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  try {
    console.log("🔍 Starting detailed token debug...");

    // Get user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'NO_AUTH' }), {
        status: 401,
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ 
        error: 'AUTH_FAILED', 
        details: authError?.message 
      }), {
        status: 401,
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' }
      });
    }

    console.log(`🔍 Debugging tokens for user: ${user.id}`);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get all token data
    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from("google_drive_tokens")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (tokenError || !tokenData) {
      return new Response(JSON.stringify({
        error: 'NO_TOKEN_DATA',
        tokenError: tokenError?.message,
        hasData: !!tokenData
      }), {
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' }
      });
    }

    // Analyze the secret IDs
    const accessSecretId = tokenData.access_token_secret_id;
    const refreshSecretId = tokenData.refresh_token_secret_id;

    const result = {
      user_id: user.id,
      timestamp: new Date().toISOString(),
      token_record: {
        id: tokenData.id,
        expires_at: tokenData.expires_at,
        created_at: tokenData.created_at,
        scopes: tokenData.scopes,
        dedicated_folder_id: tokenData.dedicated_folder_id
      },
      secret_analysis: {
        access_token_secret_id: {
          value: accessSecretId,
          type: typeof accessSecretId,
          length: accessSecretId?.length,
          is_uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(accessSecretId),
          is_base64_like: /^[A-Za-z0-9+/=]+$/.test(accessSecretId) && accessSecretId.length > 20,
          first_10_chars: accessSecretId?.substring(0, 10),
          last_10_chars: accessSecretId?.substring(-10)
        },
        refresh_token_secret_id: {
          value: refreshSecretId,
          type: typeof refreshSecretId,
          length: refreshSecretId?.length,
          is_uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(refreshSecretId),
          is_base64_like: /^[A-Za-z0-9+/=]+$/.test(refreshSecretId) && refreshSecretId.length > 20,
          first_10_chars: refreshSecretId?.substring(0, 10),
          last_10_chars: refreshSecretId?.substring(-10)
        }
      }
    };

    // Test decryption attempt
    if (result.secret_analysis.access_token_secret_id.is_base64_like) {
      console.log("🔍 Attempting decryption test...");
      
      try {
        // Test if it's encrypted with our key
        const b64ToU8 = (b64: string) => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
        const keyRaw = b64ToU8(Deno.env.get("TOKEN_ENC_KEY")!);
        const key = await crypto.subtle.importKey("raw", keyRaw, { name: "AES-GCM" }, false, ["decrypt"]);
        
        const buf = b64ToU8(accessSecretId);
        const iv = buf.slice(0, 12);
        const ct = buf.slice(12);
        
        const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
        const decrypted = new TextDecoder().decode(pt);
        
        result.decryption_test = {
          success: true,
          decrypted_preview: decrypted.substring(0, 20) + "...",
          decrypted_length: decrypted.length
        };
        
        console.log("✅ Decryption successful!");
        
      } catch (decryptError) {
        result.decryption_test = {
          success: false,
          error: decryptError instanceof Error ? decryptError.message : 'Unknown error'
        };
        console.log("❌ Decryption failed:", decryptError);
      }
    }

    return new Response(JSON.stringify(result, null, 2), {
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Debug error:', error);
    return new Response(JSON.stringify({ 
      error: "DEBUG_FAILED", 
      message: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json' }
    });
  }
});