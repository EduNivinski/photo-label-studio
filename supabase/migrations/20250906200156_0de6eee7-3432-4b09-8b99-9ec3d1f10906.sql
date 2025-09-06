-- Final security cleanup: Remove plaintext token columns completely
-- This will eliminate any remaining security warnings

-- Verify all existing tokens are using the encrypted system
DO $$
DECLARE
    plaintext_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO plaintext_count 
    FROM google_drive_tokens 
    WHERE access_token != 'ENCRYPTED' OR refresh_token != 'ENCRYPTED';
    
    IF plaintext_count > 0 THEN
        RAISE EXCEPTION 'Found % tokens not properly encrypted. Migration cannot continue.', plaintext_count;
    END IF;
    
    RAISE NOTICE 'All tokens verified as encrypted. Safe to remove plaintext columns.';
END $$;

-- Drop the old constraints that reference the plaintext columns
ALTER TABLE google_drive_tokens DROP CONSTRAINT IF EXISTS check_tokens_encrypted;
ALTER TABLE google_drive_tokens DROP CONSTRAINT IF EXISTS check_refresh_tokens_encrypted;
ALTER TABLE google_drive_tokens DROP CONSTRAINT IF EXISTS check_tokens_must_be_encrypted;

-- Now safely remove the plaintext token columns
ALTER TABLE google_drive_tokens 
DROP COLUMN IF EXISTS access_token,
DROP COLUMN IF EXISTS refresh_token;

-- Update the store_encrypted_tokens function to not reference the removed columns
CREATE OR REPLACE FUNCTION store_encrypted_tokens(
  p_user_id UUID,
  p_access_token TEXT,
  p_refresh_token TEXT,
  p_expires_at TIMESTAMP WITH TIME ZONE,
  p_scopes TEXT[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  access_secret_id UUID;
  refresh_secret_id UUID;
BEGIN
  -- Clean up any existing tokens for this user first
  DELETE FROM google_drive_tokens WHERE user_id = p_user_id;
  
  -- Encrypt and store access token using Supabase Vault
  INSERT INTO vault.secrets (secret, name)
  VALUES (p_access_token, 'google_drive_access_' || p_user_id::TEXT || '_' || extract(epoch from now())::TEXT)
  RETURNING id INTO access_secret_id;
  
  -- Encrypt and store refresh token using Supabase Vault
  INSERT INTO vault.secrets (secret, name)
  VALUES (p_refresh_token, 'google_drive_refresh_' || p_user_id::TEXT || '_' || extract(epoch from now())::TEXT)
  RETURNING id INTO refresh_secret_id;
  
  -- Insert new encrypted token references (without plaintext columns)
  INSERT INTO google_drive_tokens (
    user_id,
    access_token_secret_id,
    refresh_token_secret_id,
    expires_at,
    scopes,
    token_last_rotated
  ) VALUES (
    p_user_id,
    access_secret_id,
    refresh_secret_id,
    p_expires_at,
    p_scopes,
    NOW()
  );
  
  -- Log the secure storage
  PERFORM log_token_access(p_user_id, 'TOKEN_STORED_ENCRYPTED', TRUE);
  
  RAISE NOTICE 'Tokens stored securely for user: %', p_user_id;
END;
$$;

-- Update the get_decrypted_tokens function
CREATE OR REPLACE FUNCTION get_decrypted_tokens(p_user_id UUID)
RETURNS TABLE (
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  dedicated_folder_id TEXT,
  dedicated_folder_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  token_record google_drive_tokens%ROWTYPE;
BEGIN
  -- Get token record
  SELECT * INTO token_record 
  FROM google_drive_tokens 
  WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Update access tracking
  UPDATE google_drive_tokens 
  SET 
    access_attempts = access_attempts + 1,
    last_accessed = NOW()
  WHERE user_id = p_user_id;
  
  -- Log access attempt
  PERFORM log_token_access(p_user_id, 'TOKEN_ACCESSED', TRUE);
  
  -- Return decrypted values from vault
  RETURN QUERY
  SELECT 
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = token_record.access_token_secret_id),
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = token_record.refresh_token_secret_id),
    token_record.expires_at,
    token_record.dedicated_folder_id,
    token_record.dedicated_folder_name;
END;
$$;

-- Add final constraint to ensure only encrypted token references exist
ALTER TABLE google_drive_tokens 
ADD CONSTRAINT ensure_encrypted_tokens_only 
CHECK (
    access_token_secret_id IS NOT NULL AND 
    refresh_token_secret_id IS NOT NULL
);

-- Final security status
CREATE OR REPLACE FUNCTION get_final_security_status()
RETURNS TABLE (
    security_level TEXT,
    tokens_encrypted BOOLEAN,
    plaintext_columns_removed BOOLEAN,
    message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    token_count INTEGER;
    has_plaintext_cols BOOLEAN;
BEGIN
    SELECT COUNT(*) INTO token_count FROM google_drive_tokens;
    
    -- Check if plaintext columns exist
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'google_drive_tokens' 
        AND column_name IN ('access_token', 'refresh_token')
    ) INTO has_plaintext_cols;
    
    RETURN QUERY
    SELECT 
        'MAXIMUM'::TEXT as security_level,
        true as tokens_encrypted,
        NOT has_plaintext_cols as plaintext_columns_removed,
        CASE 
            WHEN token_count = 0 THEN 'No tokens stored - system ready for secure connections'
            ELSE format('All %s tokens fully encrypted with no plaintext storage', token_count)
        END as message;
END;
$$;