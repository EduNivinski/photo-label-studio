import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(s: number, b: unknown) {
  return new Response(JSON.stringify(b), { 
    status: s, 
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🔄 Force Drive Reconnect - clearing invalid tokens...");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const userId = body.user_id;
    
    if (!userId) {
      return json(400, { error: 'USER_ID_REQUIRED' });
    }

    console.log(`🔄 Clearing tokens for user: ${userId}`);

    // 1. Delete existing tokens from database
    const { error: deleteError } = await supabase
      .from('google_drive_tokens')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      console.error("❌ Error deleting tokens:", deleteError);
      return json(500, {
        error: 'DELETE_ERROR',
        message: 'Failed to delete existing tokens',
        details: deleteError.message
      });
    }

    console.log("✅ Successfully deleted old tokens from database");

    // 2. Try to clean up Vault secrets (these might not exist, that's OK)
    try {
      // Try to rotate the old secrets to empty values
      const accessSecretName = `gd_access_${userId}`;
      const refreshSecretName = `gd_refresh_${userId}`;
      
      console.log(`🔄 Attempting to clean vault secrets: ${accessSecretName}, ${refreshSecretName}`);
      
      // We can't directly delete from Vault in edge functions, but we can rotate to empty
      // This is handled by the RPC functions, so we'll skip this for now
      
    } catch (vaultError) {
      console.log("⚠️ Vault cleanup attempted (may not exist):", vaultError);
    }

    // 3. Generate new OAuth URL for re-authentication
    const clientId = Deno.env.get('GOOGLE_DRIVE_CLIENT_ID');
    if (!clientId) {
      return json(500, {
        error: 'CONFIG_ERROR',
        message: 'Google Drive client ID not configured'
      });
    }

    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-drive-oauth-callback`;
    const scopes = [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive.readonly'
    ].join(' ');

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', scopes);
    authUrl.searchParams.append('access_type', 'offline');
    authUrl.searchParams.append('prompt', 'consent');
    authUrl.searchParams.append('state', userId);

    console.log("✅ Generated new OAuth URL for reconnection");

    return json(200, {
      success: true,
      message: 'Old tokens cleared successfully. User needs to re-authenticate.',
      oauth_url: authUrl.toString(),
      instructions: [
        '1. Old invalid tokens have been cleared',
        '2. Visit the oauth_url to re-authenticate with Google Drive',
        '3. After authentication, tokens will be stored securely',
        '4. Then try accessing Google Drive features again'
      ]
    });

  } catch (error: any) {
    console.error('❌ General error:', error);
    return json(500, { 
      error: "GENERAL_ERROR", 
      message: error.message,
      stack: error.stack
    });
  }
});