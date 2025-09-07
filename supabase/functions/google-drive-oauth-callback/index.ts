import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { upsertTokens } from "../_shared/token_provider_v2.ts";

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
    const expiresAt = new Date(Date.now() + expires_in * 1000);
    const scopeArray = scope ? scope.split(' ') : [];

    // Store encrypted tokens using new provider
    await upsertTokens(user_id, access_token, refresh_token, scopeArray, expiresAt);

    console.log(`OAuth callback successful for user ${user_id} - tokens stored securely`);

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Google Drive connected successfully",
      expires_at: expiresAt.toISOString()
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