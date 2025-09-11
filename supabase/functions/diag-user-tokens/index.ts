import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { preflight, jsonCors } from "../_shared/cors.ts";

serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;

  try {
    console.log("🔍 Starting user token diagnostics...");

    // Get user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonCors(req, 401, { error: 'NO_AUTH' });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return jsonCors(req, 401, { 
        error: 'AUTH_FAILED', 
        details: authError?.message 
      });
    }

    console.log(`🔍 Checking tokens for user: ${user.id}`);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check google_drive_tokens table
    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from("google_drive_tokens")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    const result = {
      user_id: user.id,
      timestamp: new Date().toISOString(),
      google_drive_tokens_table: {
        has_record: !!tokenData,
        error: tokenError?.message || null,
        record_details: tokenData ? {
          expires_at: tokenData.expires_at,
          scopes: tokenData.scopes,
          has_access_token_secret_id: !!tokenData.access_token_secret_id,
          has_refresh_token_secret_id: !!tokenData.refresh_token_secret_id,
          dedicated_folder_id: tokenData.dedicated_folder_id,
          created_at: tokenData.created_at
        } : null
      }
    };

    // If we have token metadata, check Vault
    if (tokenData?.access_token_secret_id) {
      const accessSecretName = `gd_access_${user.id}`;
      const refreshSecretName = `gd_refresh_${user.id}`;

      // Check if secrets exist in Vault
      const { data: accessVault, error: accessVaultError } = await supabaseAdmin
        .from("vault.decrypted_secrets")
        .select("name, created_at")
        .eq("name", accessSecretName)
        .maybeSingle();

      const { data: refreshVault, error: refreshVaultError } = await supabaseAdmin
        .from("vault.decrypted_secrets")
        .select("name, created_at")
        .eq("name", refreshSecretName)
        .maybeSingle();

      result.vault_secrets = {
        access_token: {
          exists: !!accessVault,
          error: accessVaultError?.message || null,
          created_at: accessVault?.created_at || null
        },
        refresh_token: {
          exists: !!refreshVault,
          error: refreshVaultError?.message || null,
          created_at: refreshVault?.created_at || null
        }
      };
    }

    // Overall assessment
    const hasTokenRecord = !!tokenData;
    const hasValidSecretIds = tokenData?.access_token_secret_id && tokenData?.refresh_token_secret_id;
    const hasVaultSecrets = result.vault_secrets?.access_token?.exists && result.vault_secrets?.refresh_token?.exists;

    result.assessment = {
      status: hasTokenRecord && hasValidSecretIds && hasVaultSecrets ? 'READY' : 'MISSING_TOKENS',
      has_token_record: hasTokenRecord,
      has_secret_ids: hasValidSecretIds,
      has_vault_secrets: hasVaultSecrets,
      recommendation: !hasTokenRecord ? 
        'User needs to connect Google Drive - no token record found' :
        !hasValidSecretIds ?
        'Token record exists but secret IDs are missing - re-authentication needed' :
        !hasVaultSecrets ?
        'Token metadata exists but secrets missing from Vault - re-authentication needed' :
        'All tokens present - Google Drive integration ready'
    };

    return jsonCors(req, 200, result);

  } catch (error: any) {
    console.error('User token diagnostic error:', error);
    return jsonCors(req, 500, { 
      error: "DIAGNOSTIC_FAILED", 
      message: error.message,
      stack: error.stack
    });
  }
});