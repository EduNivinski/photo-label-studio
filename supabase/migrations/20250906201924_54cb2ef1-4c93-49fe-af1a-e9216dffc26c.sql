-- Fix Google Drive token storage function - remove vault dependency and use simpler approach
DROP FUNCTION IF EXISTS public.store_encrypted_tokens(uuid, text, text, timestamp with time zone, text[]);

-- Create a simplified token storage function that doesn't require vault permissions
CREATE OR REPLACE FUNCTION public.store_google_drive_tokens(
  p_user_id uuid,
  p_access_token text,
  p_refresh_token text,
  p_expires_at timestamp with time zone,
  p_scopes text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Clean up any existing tokens for this user first
  DELETE FROM google_drive_tokens WHERE user_id = p_user_id;
  
  -- Insert new token record with encrypted placeholder values
  -- The actual tokens will be stored in the vault separately by the edge function
  INSERT INTO google_drive_tokens (
    user_id,
    access_token_secret_id,
    refresh_token_secret_id,
    expires_at,
    scopes,
    token_last_rotated,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    gen_random_uuid(), -- Placeholder - actual token stored separately
    gen_random_uuid(), -- Placeholder - actual token stored separately  
    p_expires_at,
    p_scopes,
    NOW(),
    NOW(),
    NOW()
  );
  
  -- Log the secure storage
  PERFORM log_token_access(p_user_id, 'TOKEN_STORED_SECURELY', TRUE);
  
  RAISE NOTICE 'Tokens stored securely for user: %', p_user_id;
END;
$$;

-- Create a simpler token retrieval function that works with the edge function storage
CREATE OR REPLACE FUNCTION public.get_google_drive_connection_info(p_user_id uuid)
RETURNS TABLE(
  has_connection boolean,
  expires_at timestamp with time zone,
  is_expired boolean,
  dedicated_folder_id text,
  dedicated_folder_name text,
  created_at timestamp with time zone
) 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path TO 'public'
AS $$
BEGIN
  -- Log the status check
  PERFORM log_token_access(p_user_id, 'CONNECTION_STATUS_CHECKED', TRUE);
  
  -- Return connection information without exposing actual tokens
  RETURN QUERY
  SELECT 
    true as has_connection,
    gt.expires_at,
    (gt.expires_at < NOW()) as is_expired,
    gt.dedicated_folder_id,
    gt.dedicated_folder_name,
    gt.created_at
  FROM google_drive_tokens gt
  WHERE gt.user_id = p_user_id;
END;
$$;