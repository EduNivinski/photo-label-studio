import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Crypto utilities for AES-GCM encryption
const b64ToU8 = (b64: string) => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
const u8ToB64 = (u8: Uint8Array) => btoa(String.fromCharCode(...u8));

let cryptoKey: CryptoKey | null = null;

async function getCryptoKey() {
  if (!cryptoKey) {
    const keyRaw = b64ToU8(Deno.env.get("TOKEN_ENC_KEY")!);
    cryptoKey = await crypto.subtle.importKey("raw", keyRaw, { name: "AES-GCM" }, false, ["encrypt"]);
  }
  return cryptoKey;
}

async function encryptToB64(plain: string) {
  const key = await getCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain)));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return u8ToB64(out);
}

// Token storage
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function upsertTokens(user_id: string, access_token: string, refresh_token: string, scope: string, expires_at: string) {
  const access_token_enc = await encryptToB64(access_token);
  const refresh_token_enc = await encryptToB64(refresh_token);

  const { error } = await supabaseAdmin
    .from("private.user_drive_tokens")
    .upsert({ 
      user_id, 
      access_token_enc, 
      refresh_token_enc, 
      scope, 
      expires_at, 
      updated_at: new Date().toISOString() 
    });

  if (error) throw new Error("DB_UPSERT_ERROR");
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code, user_id, error: authError } = await req.json();
    
    if (authError) {
      console.error("OAuth error:", authError);
      return new Response(JSON.stringify({ error: authError }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!code || !user_id) {
      return new Response(JSON.stringify({ error: "Missing code or user_id" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: code,
        client_id: Deno.env.get('GOOGLE_DRIVE_CLIENT_ID')!,
        client_secret: Deno.env.get('GOOGLE_DRIVE_CLIENT_SECRET')!,
        redirect_uri: 'postmessage',
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error("Token exchange failed:", errorData);
      return new Response(JSON.stringify({ error: "Token exchange failed", details: errorData }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, scope, expires_in } = tokenData;

    if (!access_token || !refresh_token) {
      return new Response(JSON.stringify({ error: "Invalid token response" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Calculate expiration time
    const expires_at = new Date(Date.now() + expires_in * 1000).toISOString();

    // Store encrypted tokens
    await upsertTokens(user_id, access_token, refresh_token, scope || '', expires_at);

    console.log(`OAuth callback successful for user ${user_id} - tokens stored securely`);

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Google Drive connected successfully",
      expires_at 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('OAuth callback error:', error);
    return new Response(JSON.stringify({ 
      error: "Internal server error", 
      message: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});