-- Security Migration: Force users to reconnect for encrypted tokens
-- This is the safest approach to ensure no compromised tokens remain

-- First, safely clean up existing plaintext tokens
-- Users will need to reconnect, but this guarantees security

-- Log all existing connections before cleanup
INSERT INTO google_drive_token_audit (user_id, action, success)
SELECT user_id, 'TOKEN_SECURITY_CLEANUP', true
FROM google_drive_tokens 
WHERE access_token != 'ENCRYPTED' OR access_token IS NULL;

-- Remove all existing tokens (both plaintext and any incomplete encrypted ones)
-- This forces all users to reconnect with the new secure system
DELETE FROM google_drive_tokens;

-- Now add constraints to ensure only encrypted tokens can be stored
ALTER TABLE google_drive_tokens 
ADD CONSTRAINT check_tokens_must_be_encrypted 
CHECK (
    access_token = 'ENCRYPTED' AND 
    refresh_token = 'ENCRYPTED' AND
    access_token_secret_id IS NOT NULL AND 
    refresh_token_secret_id IS NOT NULL
);

-- Make the secret ID columns non-nullable for new records
ALTER TABLE google_drive_tokens 
ALTER COLUMN access_token_secret_id SET NOT NULL,
ALTER COLUMN refresh_token_secret_id SET NOT NULL;

-- Set default values to ensure encryption
ALTER TABLE google_drive_tokens 
ALTER COLUMN access_token SET DEFAULT 'ENCRYPTED',
ALTER COLUMN refresh_token SET DEFAULT 'ENCRYPTED';

-- Create a secure view that never exposes tokens
CREATE OR REPLACE VIEW google_drive_connections_secure AS
SELECT 
    user_id,
    'ENCRYPTED' as token_status,
    expires_at,
    dedicated_folder_id,
    dedicated_folder_name,
    token_last_rotated,
    access_attempts,
    last_accessed,
    created_at,
    updated_at
FROM google_drive_tokens;

-- Grant access to the secure view
GRANT SELECT ON google_drive_connections_secure TO authenticated;

-- Update the store_encrypted_tokens function to be more robust
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
  
  -- Insert new encrypted token references with required constraints
  INSERT INTO google_drive_tokens (
    user_id,
    access_token_secret_id,
    refresh_token_secret_id,
    access_token,
    refresh_token,
    expires_at,
    scopes,
    token_last_rotated
  ) VALUES (
    p_user_id,
    access_secret_id,
    refresh_secret_id,
    'ENCRYPTED',
    'ENCRYPTED',
    p_expires_at,
    p_scopes,
    NOW()
  );
  
  -- Log the secure storage
  PERFORM log_token_access(p_user_id, 'TOKEN_STORED_ENCRYPTED', TRUE);
  
  RAISE NOTICE 'Tokens stored securely for user: %', p_user_id;
END;
$$;

-- Create function to verify all tokens are encrypted
CREATE OR REPLACE FUNCTION verify_token_security()
RETURNS TABLE (
    total_tokens INTEGER,
    all_encrypted BOOLEAN,
    security_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    token_count INTEGER;
    encrypted_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO token_count FROM google_drive_tokens;
    
    SELECT COUNT(*) INTO encrypted_count 
    FROM google_drive_tokens 
    WHERE access_token = 'ENCRYPTED' 
    AND refresh_token = 'ENCRYPTED'
    AND access_token_secret_id IS NOT NULL
    AND refresh_token_secret_id IS NOT NULL;
    
    RETURN QUERY
    SELECT 
        token_count,
        (token_count = encrypted_count),
        CASE 
            WHEN token_count = 0 THEN 'NO_TOKENS'
            WHEN token_count = encrypted_count THEN 'ALL_SECURE'
            ELSE 'SECURITY_RISK'
        END;
END;
$$;