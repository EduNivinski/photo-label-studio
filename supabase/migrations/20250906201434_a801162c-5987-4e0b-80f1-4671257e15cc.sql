-- Fix Security Events RLS Policy - remove system event exposure
DROP POLICY IF EXISTS "Users can view their own security events" ON security_events;

-- Create more restrictive policy that only allows users to view their own events (no system events)
CREATE POLICY "Users can view only their own security events" 
ON security_events 
FOR SELECT 
USING (auth.uid() = user_id AND user_id IS NOT NULL);

-- Add additional security for Google Drive tokens - ensure tokens are never exposed
CREATE OR REPLACE FUNCTION public.get_google_drive_token_status(p_user_id uuid)
RETURNS TABLE(
  has_token boolean,
  expires_at timestamp with time zone,
  is_expired boolean,
  dedicated_folder_id text,
  dedicated_folder_name text
) 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path TO 'public'
AS $$
BEGIN
  -- Only return status information, never actual tokens
  RETURN QUERY
  SELECT 
    true as has_token,
    gt.expires_at,
    (gt.expires_at < NOW()) as is_expired,
    gt.dedicated_folder_id,
    gt.dedicated_folder_name
  FROM google_drive_tokens gt
  WHERE gt.user_id = p_user_id;
  
  -- Log the status check
  PERFORM log_token_access(p_user_id, 'TOKEN_STATUS_CHECKED', TRUE);
END;
$$;

-- Add function to securely validate token access without exposing tokens
CREATE OR REPLACE FUNCTION public.validate_google_drive_access(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  token_exists boolean := false;
  token_expired boolean := true;
BEGIN
  SELECT 
    (gt.id IS NOT NULL),
    (gt.expires_at < NOW())
  INTO token_exists, token_expired
  FROM google_drive_tokens gt
  WHERE gt.user_id = p_user_id;
  
  -- Log validation attempt
  PERFORM log_token_access(
    p_user_id, 
    'TOKEN_VALIDATION', 
    token_exists AND NOT token_expired
  );
  
  RETURN token_exists AND NOT token_expired;
END;
$$;