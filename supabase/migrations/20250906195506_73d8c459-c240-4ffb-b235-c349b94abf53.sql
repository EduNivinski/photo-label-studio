-- Fix security issues: Add search_path to all functions for security

-- Fix encrypt_token function
CREATE OR REPLACE FUNCTION encrypt_token(token_value TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  encrypted_value TEXT;
BEGIN
  -- Use Supabase's built-in encryption with a random key
  SELECT vault.create_secret(token_value, 'google_drive_token_' || gen_random_uuid()::TEXT) INTO encrypted_value;
  RETURN encrypted_value;
END;
$$;

-- Fix decrypt_token function
CREATE OR REPLACE FUNCTION decrypt_token(secret_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  decrypted_value TEXT;
BEGIN
  SELECT decrypted_secret INTO decrypted_value FROM vault.decrypted_secrets WHERE id = secret_id;
  RETURN decrypted_value;
END;
$$;

-- Fix log_token_access function
CREATE OR REPLACE FUNCTION log_token_access(
  p_user_id UUID,
  p_action TEXT,
  p_success BOOLEAN DEFAULT TRUE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO google_drive_token_audit (user_id, action, success)
  VALUES (p_user_id, p_action, p_success);
END;
$$;

-- Fix store_encrypted_tokens function
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

-- Fix get_decrypted_tokens function
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

-- Fix rotate_expired_tokens function
CREATE OR REPLACE FUNCTION rotate_expired_tokens()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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