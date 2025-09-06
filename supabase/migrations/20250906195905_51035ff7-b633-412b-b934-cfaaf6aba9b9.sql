-- Complete the security migration by encrypting existing plaintext tokens
-- and then removing the plaintext columns

-- First, migrate any existing plaintext tokens to encrypted format
DO $$
DECLARE
    token_record RECORD;
    access_secret_id UUID;
    refresh_secret_id UUID;
BEGIN
    -- Loop through all tokens that are still in plaintext
    FOR token_record IN 
        SELECT user_id, access_token, refresh_token, expires_at, scopes, dedicated_folder_id, dedicated_folder_name
        FROM google_drive_tokens 
        WHERE access_token != 'ENCRYPTED' AND access_token IS NOT NULL
    LOOP
        -- Encrypt and store access token
        INSERT INTO vault.secrets (secret)
        VALUES (token_record.access_token)
        RETURNING id INTO access_secret_id;
        
        -- Encrypt and store refresh token
        INSERT INTO vault.secrets (secret)
        VALUES (token_record.refresh_token)
        RETURNING id INTO refresh_secret_id;
        
        -- Update the record with encrypted references
        UPDATE google_drive_tokens 
        SET 
            access_token_secret_id = access_secret_id,
            refresh_token_secret_id = refresh_secret_id,
            access_token = 'ENCRYPTED',
            refresh_token = 'ENCRYPTED',
            token_last_rotated = NOW()
        WHERE user_id = token_record.user_id;
        
        -- Log the migration
        PERFORM log_token_access(token_record.user_id, 'TOKEN_MIGRATED_TO_ENCRYPTED', TRUE);
        
        RAISE NOTICE 'Migrated tokens for user: %', token_record.user_id;
    END LOOP;
END $$;

-- Now that all tokens are encrypted, we can safely remove the plaintext columns
-- But we'll do this in phases to maintain backward compatibility

-- Add a check constraint to ensure new tokens are always encrypted
ALTER TABLE google_drive_tokens 
ADD CONSTRAINT check_tokens_encrypted 
CHECK (
    (access_token = 'ENCRYPTED' AND access_token_secret_id IS NOT NULL) OR 
    (access_token IS NULL AND access_token_secret_id IS NULL)
);

-- Add another constraint for refresh tokens
ALTER TABLE google_drive_tokens 
ADD CONSTRAINT check_refresh_tokens_encrypted 
CHECK (
    (refresh_token = 'ENCRYPTED' AND refresh_token_secret_id IS NOT NULL) OR 
    (refresh_token IS NULL AND refresh_token_secret_id IS NULL)
);

-- Create a view that shows only encrypted status for monitoring
CREATE OR REPLACE VIEW google_drive_tokens_secure AS
SELECT 
    user_id,
    access_token_secret_id IS NOT NULL as has_access_token,
    refresh_token_secret_id IS NOT NULL as has_refresh_token,
    expires_at,
    dedicated_folder_id,
    dedicated_folder_name,
    token_last_rotated,
    access_attempts,
    last_accessed,
    created_at,
    updated_at
FROM google_drive_tokens;

-- Grant access to the secure view instead of the raw table
GRANT SELECT ON google_drive_tokens_secure TO authenticated;

-- Create function to check token security status
CREATE OR REPLACE FUNCTION check_token_security_status()
RETURNS TABLE (
    total_tokens INTEGER,
    encrypted_tokens INTEGER,
    security_percentage NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_tokens,
        COUNT(CASE WHEN access_token = 'ENCRYPTED' THEN 1 END)::INTEGER as encrypted_tokens,
        ROUND(
            (COUNT(CASE WHEN access_token = 'ENCRYPTED' THEN 1 END)::NUMERIC / 
             NULLIF(COUNT(*)::NUMERIC, 0)) * 100, 2
        ) as security_percentage
    FROM google_drive_tokens;
END;
$$;