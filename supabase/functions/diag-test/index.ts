import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Vary": "Origin",
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
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

    // Test 3: Check google_drive_tokens table and vault access
    let schemaTest = "FAIL";
    let schemaDetails = "";
    let vaultTest = "FAIL";
    let vaultDetails = "";
    
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      
      console.log("Testing access to google_drive_tokens table...");
      
      // Try to access the google_drive_tokens table
      const { data, error } = await supabase
        .from("google_drive_tokens")
        .select("user_id")
        .limit(1);
      
      if (error) {
        console.error("Schema access error:", error);
        schemaTest = `ACCESS_ERROR`;
        schemaDetails = error.message;
        
        // Check specific error types
        if (error.message.includes("does not exist")) {
          schemaTest = "TABLE_NOT_EXISTS";
        } else if (error.message.includes("permission")) {
          schemaTest = "PERMISSION_DENIED";
        }
      } else {
        schemaTest = "OK";
        schemaDetails = "google_drive_tokens table accessible";
        console.log("Schema access successful");
      }
      
      // Test vault access
      console.log("Testing Vault access...");
      const { data: vaultData, error: vaultError } = await supabase
        .from("vault.decrypted_secrets")
        .select("count", { count: "exact", head: true });
        
      if (vaultError) {
        console.error("Vault access error:", vaultError);
        vaultTest = "ACCESS_ERROR";
        vaultDetails = vaultError.message;
      } else {
        vaultTest = "OK";
        vaultDetails = "Vault accessible";
        console.log("Vault access successful");
      }
      
    } catch (e: any) {
      console.error("Schema/Vault test exception:", e);
      schemaTest = `EXCEPTION`;
      schemaDetails = e.message;
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
        googleDriveTokensTable: schemaTest,
        schemaDetails: schemaDetails,
        vaultAccess: vaultTest,
        vaultDetails: vaultDetails,
        cryptoKey: cryptoTest
      },
      recommendation: !hasTokenKey ? 
        "Set TOKEN_ENC_KEY environment variable (generate: openssl rand -base64 32)" :
        schemaTest !== "OK" ?
        `google_drive_tokens table access issue: ${schemaTest} - ${schemaDetails}` :
        vaultTest !== "OK" ?
        `Vault access issue: ${vaultTest} - ${vaultDetails}` :
        cryptoTest !== "OK" ?
        "Crypto key issue - check TOKEN_ENC_KEY format" :
        "All systems OK - Ready for Google Drive integration"
    };

    console.log("=== DIAGNOSTIC RESULT ===", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Diagnostic test error:', error);
    return new Response(JSON.stringify({ 
      error: "Diagnostic failed", 
      message: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json' }
    });
  }
});