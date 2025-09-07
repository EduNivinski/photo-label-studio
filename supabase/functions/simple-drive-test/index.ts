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
    console.log("🔍 Simple Drive Test - checking tokens directly from database...");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const userId = body.user_id;
    
    if (!userId) {
      return json(400, { error: 'USER_ID_REQUIRED' });
    }

    console.log(`🔍 Checking for user: ${userId}`);

    // 1. Check if user has Google Drive tokens in database
    const { data: tokenData, error: tokenError } = await supabase
      .from('google_drive_tokens')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (tokenError) {
      console.error("❌ No tokens found in database:", tokenError);
      return json(404, { 
        error: 'NO_TOKENS_IN_DB', 
        message: 'User has no Google Drive tokens in database',
        details: tokenError.message
      });
    }

    console.log("✅ Found token record in database");
    console.log("Token data:", {
      user_id: tokenData.user_id,
      expires_at: tokenData.expires_at,
      is_expired: new Date(tokenData.expires_at) < new Date(),
      has_access_secret_id: !!tokenData.access_token_secret_id,
      has_refresh_secret_id: !!tokenData.refresh_token_secret_id,
      dedicated_folder: {
        id: tokenData.dedicated_folder_id,
        name: tokenData.dedicated_folder_name
      }
    });

    // 2. Check if token is expired
    if (new Date(tokenData.expires_at) < new Date()) {
      return json(400, {
        error: 'TOKEN_EXPIRED',
        message: 'Google Drive token has expired',
        expires_at: tokenData.expires_at
      });
    }

    // 3. Try to get tokens from Vault
    let accessToken;
    try {
      console.log("🔍 Attempting to get access token from Vault...");
      
      const { data: vaultData, error: vaultError } = await supabase
        .from('vault.decrypted_secrets')
        .select('decrypted_secret')
        .eq('name', `gd_access_${userId}`)
        .single();

      if (vaultError) {
        console.error("❌ Vault access error:", vaultError);
        return json(500, {
          error: 'VAULT_ACCESS_ERROR',
          message: 'Cannot access tokens from Vault',
          details: vaultError.message,
          vault_error_code: vaultError.code
        });
      }

      accessToken = vaultData.decrypted_secret;
      console.log("✅ Successfully retrieved access token from Vault");

    } catch (error) {
      console.error("❌ Exception accessing Vault:", error);
      return json(500, {
        error: 'VAULT_EXCEPTION',
        message: 'Exception while accessing Vault',
        details: error instanceof Error ? error.message : String(error)
      });
    }

    // 4. Test Google Drive API with the token
    if (accessToken) {
      console.log("🔍 Testing Google Drive API access...");
      
      try {
        const driveResponse = await fetch(
          "https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.folder' and parents in 'root'&fields=files(id,name)&pageSize=10",
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        console.log(`Drive API response status: ${driveResponse.status}`);

        if (driveResponse.ok) {
          const driveData = await driveResponse.json();
          console.log(`✅ Drive API success! Found ${driveData.files?.length || 0} folders`);
          
          return json(200, {
            success: true,
            test_results: {
              database: 'OK',
              vault: 'OK', 
              google_drive_api: 'OK'
            },
            token_info: {
              user_id: userId,
              expires_at: tokenData.expires_at,
              is_expired: false
            },
            drive_folders: {
              count: driveData.files?.length || 0,
              folders: driveData.files?.slice(0, 5) || []
            }
          });
        } else {
          const errorText = await driveResponse.text();
          console.error("❌ Drive API error:", driveResponse.status, errorText);
          
          return json(500, {
            error: 'DRIVE_API_ERROR',
            message: 'Google Drive API call failed',
            status: driveResponse.status,
            details: errorText
          });
        }
      } catch (fetchError) {
        console.error("❌ Drive API fetch error:", fetchError);
        return json(500, {
          error: 'DRIVE_API_FETCH_ERROR',
          message: 'Failed to call Google Drive API',
          details: fetchError instanceof Error ? fetchError.message : String(fetchError)
        });
      }
    }

    return json(500, {
      error: 'NO_ACCESS_TOKEN',
      message: 'Could not retrieve access token'
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