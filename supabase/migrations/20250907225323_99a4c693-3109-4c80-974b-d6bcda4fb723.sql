-- Remove old Vault-based functions and cleanup
-- These are no longer needed with the new token_provider_v2.ts approach

-- Drop old RPC functions that used Vault
DROP FUNCTION IF EXISTS public.get_google_drive_tokens_secure(uuid);
DROP FUNCTION IF EXISTS public.log_token_access(uuid, text, boolean);

-- Clean up old google_drive_tokens table if it exists (replaced by private.user_drive_tokens)
DROP TABLE IF EXISTS public.google_drive_tokens CASCADE;

-- Remove any old debugging tables that might exist
DROP TABLE IF EXISTS public.gd_token_debug CASCADE;