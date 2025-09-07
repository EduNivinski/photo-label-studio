import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("=== DIAGNOSTIC TEST START ===");
    
    // Test 1: Check environment variables
    const hasTokenKey = !!Deno.env.get("TOKEN_ENC_KEY");
    const hasSupabaseUrl = !!Deno.env.get("SUPABASE_URL");
    const hasServiceKey = !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    console.log("Environment check:", { hasTokenKey, hasSupabaseUrl, hasServiceKey });

    // Test 2: Check if we can create Supabase client
    let supabaseTest = "FAIL";
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      supabaseTest = "OK";
    } catch (e) {
      console.error("Supabase client error:", e);
    }

    // Test 3: Check if private schema exists
    let schemaTest = "FAIL";
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const { data, error } = await supabase
        .from("private.user_drive_tokens")
        .select("count(*)")
        .limit(1);
      
      if (error) {
        console.error("Schema test error:", error);
        schemaTest = `ERROR: ${error.message}`;
      } else {
        schemaTest = "OK";
      }
    } catch (e: any) {
      console.error("Schema test exception:", e);
      schemaTest = `EXCEPTION: ${e.message}`;
    }

    // Test 4: Check if we can init crypto key
    let cryptoTest = "FAIL";
    try {
      if (hasTokenKey) {
        const b64ToU8 = (b64: string) => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
        const keyRaw = b64ToU8(Deno.env.get("TOKEN_ENC_KEY")!);
        await crypto.subtle.importKey("raw", keyRaw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
        cryptoTest = "OK";
      } else {
        cryptoTest = "NO_KEY";
      }
    } catch (e: any) {
      console.error("Crypto test error:", e);
      cryptoTest = `ERROR: ${e.message}`;
    }

    const result = {
      timestamp: new Date().toISOString(),
      environment: {
        hasTokenKey,
        hasSupabaseUrl,
        hasServiceKey
      },
      tests: {
        supabaseClient: supabaseTest,
        privateSchema: schemaTest,
        cryptoKey: cryptoTest
      },
      recommendation: !hasTokenKey ? 
        "Set TOKEN_ENC_KEY environment variable (generate: openssl rand -base64 32)" :
        schemaTest !== "OK" ?
        "Private schema access issue - check service_role permissions" :
        cryptoTest !== "OK" ?
        "Crypto key issue - check TOKEN_ENC_KEY format" :
        "All systems OK - user needs to re-authenticate with Google Drive"
    };

    console.log("=== DIAGNOSTIC RESULT ===", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Diagnostic test error:', error);
    return new Response(JSON.stringify({ 
      error: "Diagnostic failed", 
      message: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});