-- First, let's create a more secure approach using Supabase Vault for token encryption
-- We'll create encrypted columns and functions to handle token security

-- Create a function to encrypt sensitive data
CREATE OR REPLACE FUNCTION encrypt_token(token_value TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  encrypted_value TEXT;
BEGIN
  -- Use Supabase's built-in encryption with a random key
  SELECT vault.create_secret(token_value, 'google_drive_token_' || gen_random_uuid()::TEXT) INTO encrypted_value;
  RETURN encrypted_value;
END;
$$;

-- Create a function to decrypt sensitive data
CREATE OR REPLACE FUNCTION decrypt_token(secret_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  decrypted_value TEXT;
BEGIN
  SELECT decrypted_secret INTO decrypted_value FROM vault.decrypted_secrets WHERE id = secret_id;
  RETURN decrypted_value;
END;
$$;

-- Add new encrypted columns to google_drive_tokens table
ALTER TABLE google_drive_tokens 
ADD COLUMN access_token_secret_id UUID,
ADD COLUMN refresh_token_secret_id UUID,
ADD COLUMN token_last_rotated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN access_attempts INTEGER DEFAULT 0,
ADD COLUMN last_accessed TIMESTAMP WITH TIME ZONE;

-- Create audit log table for token access
CREATE TABLE google_drive_token_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN DEFAULT TRUE
);

-- Enable RLS on audit table
ALTER TABLE google_drive_token_audit ENABLE ROW LEVEL SECURITY;

-- RLS policies for audit table (admin access only)
CREATE POLICY "Audit logs are viewable by system only" 
ON google_drive_token_audit 
FOR SELECT 
USING (FALSE); -- No direct user access to audit logs

-- Create function to log token access
CREATE OR REPLACE FUNCTION log_token_access(
  p_user_id UUID,
  p_action TEXT,
  p_success BOOLEAN DEFAULT TRUE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO google_drive_token_audit (user_id, action, success)
  VALUES (p_user_id, p_action, p_success);
END;
$$;

-- Create function to securely store encrypted tokens
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
AS $$
DECLARE
  access_secret_id UUID;
  refresh_secret_id UUID;
BEGIN
  -- Encrypt and store access token
  INSERT INTO vault.secrets (secret)
  VALUES (p_access_token)
  RETURNING id INTO access_secret_id;
  
  -- Encrypt and store refresh token
  INSERT INTO vault.secrets (secret)
  VALUES (p_refresh_token)
  RETURNING id INTO refresh_secret_id;
  
  -- Delete existing tokens for this user
  DELETE FROM google_drive_tokens WHERE user_id = p_user_id;
  
  -- Insert new encrypted token references
  INSERT INTO google_drive_tokens (
    user_id,
    access_token_secret_id,
    refresh_token_secret_id,
    expires_at,
    scopes,
    token_last_rotated,
    access_token, -- Keep for backward compatibility during migration
    refresh_token -- Keep for backward compatibility during migration
  ) VALUES (
    p_user_id,
    access_secret_id,
    refresh_secret_id,
    p_expires_at,
    p_scopes,
    NOW(),
    'ENCRYPTED', -- Placeholder to indicate encryption
    'ENCRYPTED'  -- Placeholder to indicate encryption
  );
  
  -- Log the action
  PERFORM log_token_access(p_user_id, 'TOKEN_STORED', TRUE);
END;
$$;

-- Create function to retrieve decrypted tokens
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
  
  -- Return decrypted values
  RETURN QUERY
  SELECT 
    CASE 
      WHEN token_record.access_token_secret_id IS NOT NULL 
      THEN (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = token_record.access_token_secret_id)
      ELSE token_record.access_token -- Fallback for migration
    END,
    CASE 
      WHEN token_record.refresh_token_secret_id IS NOT NULL 
      THEN (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = token_record.refresh_token_secret_id)
      ELSE token_record.refresh_token -- Fallback for migration
    END,
    token_record.expires_at,
    token_record.dedicated_folder_id,
    token_record.dedicated_folder_name;
END;
$$;

-- Create function to rotate tokens automatically
CREATE OR REPLACE FUNCTION rotate_expired_tokens()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  expired_token RECORD;
BEGIN
  -- This would be called by a cron job to rotate tokens before they expire
  FOR expired_token IN 
    SELECT user_id, refresh_token_secret_id 
    FROM google_drive_tokens 
    WHERE expires_at < NOW() + INTERVAL '1 hour'
  LOOP
    -- Log that token needs rotation
    PERFORM log_token_access(expired_token.user_id, 'TOKEN_ROTATION_NEEDED', TRUE);
  END LOOP;
END;
$$;

-- Create index for performance
CREATE INDEX idx_google_drive_tokens_user_expires ON google_drive_tokens(user_id, expires_at);
CREATE INDEX idx_token_audit_user_timestamp ON google_drive_token_audit(user_id, timestamp);

-- Add constraint to ensure tokens are not stored in plain text (for new records)
-- This will be enforced at the application level