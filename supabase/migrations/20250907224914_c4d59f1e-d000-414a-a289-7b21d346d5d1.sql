-- Remove old Vault-based functions and tables
DROP FUNCTION IF EXISTS public.get_google_drive_tokens_secure(uuid);
DROP FUNCTION IF EXISTS public.store_google_drive_tokens_secure(uuid, text, text, timestamp with time zone, text[]);
DROP FUNCTION IF EXISTS public.store_google_drive_tokens_simple(uuid, uuid, uuid, timestamp with time zone, text[]);
DROP FUNCTION IF EXISTS public.verify_token_security();
DROP FUNCTION IF EXISTS public.get_final_security_status();
DROP FUNCTION IF EXISTS public.cleanup_expired_google_drive_tokens();
DROP FUNCTION IF EXISTS public.cleanup_expired_google_drive_tokens_safe();

-- Clean up old google_drive_tokens table (Vault-based)
DROP TABLE IF EXISTS public.google_drive_tokens CASCADE;

-- Clean up debug table
DROP TABLE IF EXISTS public.gd_token_debug CASCADE;

-- Clean up audit table functions that might reference old schema
DROP FUNCTION IF EXISTS public.log_token_access(uuid, text, boolean);
DROP FUNCTION IF EXISTS public.rotate_expired_tokens();

-- Note: We keep the audit table as it might have useful historical data
-- but we'll update the access patterns to work with the new system

-- Add comment to the new table
COMMENT ON TABLE private.user_drive_tokens IS 'Stores encrypted Google Drive tokens using AES-GCM encryption, replacing the old Vault-based approach';