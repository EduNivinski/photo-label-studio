-- ================================================
-- Security hardening migration
-- ================================================

-- Create security schema for rate limiting and monitoring
CREATE SCHEMA IF NOT EXISTS security;

-- ================================================
-- Rate limiting tables and functions
-- ================================================

-- Table to track rate limit hits
CREATE TABLE IF NOT EXISTS security.rate_limit_hits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ip_address text NOT NULL,
  endpoint text NOT NULL,
  hit_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_rate_limit_hits_lookup 
  ON security.rate_limit_hits(user_id, ip_address, endpoint, hit_at DESC);

-- Function to check rate limits
CREATE OR REPLACE FUNCTION security.can_call(
  p_user_id uuid,
  p_ip text,
  p_endpoint text,
  p_limit integer,
  p_window_sec integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = security, public
AS $$
DECLARE
  v_count integer;
  v_window_start timestamptz;
BEGIN
  v_window_start := now() - (p_window_sec || ' seconds')::interval;
  
  -- Count recent hits
  SELECT COUNT(*)
  INTO v_count
  FROM security.rate_limit_hits
  WHERE user_id = p_user_id
    AND ip_address = p_ip
    AND endpoint = p_endpoint
    AND hit_at > v_window_start;
  
  -- If under limit, record this hit
  IF v_count < p_limit THEN
    INSERT INTO security.rate_limit_hits (user_id, ip_address, endpoint, hit_at)
    VALUES (p_user_id, p_ip, p_endpoint, now());
    RETURN true;
  END IF;
  
  -- Over limit, log event
  INSERT INTO security.events (user_id, endpoint, kind, details)
  VALUES (
    p_user_id,
    p_endpoint,
    'RATE_LIMITED',
    jsonb_build_object(
      'ip', p_ip,
      'limit', p_limit,
      'window_sec', p_window_sec,
      'count', v_count
    )
  );
  
  RETURN false;
END;
$$;

-- ================================================
-- Security events logging
-- ================================================

-- Table for security events (server-side only)
CREATE TABLE IF NOT EXISTS security.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts timestamptz NOT NULL DEFAULT now(),
  user_id uuid,
  endpoint text NOT NULL,
  kind text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for querying events
CREATE INDEX IF NOT EXISTS idx_security_events_lookup 
  ON security.events(user_id, endpoint, kind, ts DESC);

-- ================================================
-- Signature nonce table (replay protection)
-- ================================================

CREATE TABLE IF NOT EXISTS security.signature_nonce (
  nonce text PRIMARY KEY,
  used_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 hour'),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for cleanup
CREATE INDEX IF NOT EXISTS idx_signature_nonce_expires 
  ON security.signature_nonce(expires_at);

-- Function to consume nonce (single-use)
CREATE OR REPLACE FUNCTION security.consume_nonce_once(p_nonce text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = security, public
AS $$
DECLARE
  v_exists boolean;
BEGIN
  -- Try to insert the nonce
  BEGIN
    INSERT INTO security.signature_nonce (nonce, used_at)
    VALUES (p_nonce, now());
    RETURN true;
  EXCEPTION WHEN unique_violation THEN
    -- Nonce already used
    RETURN false;
  END;
END;
$$;

-- Cleanup function for expired nonces (run periodically)
CREATE OR REPLACE FUNCTION security.cleanup_expired_nonces()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = security
AS $$
BEGIN
  DELETE FROM security.signature_nonce
  WHERE expires_at < now();
END;
$$;

-- ================================================
-- SECURITY DEFINER guards
-- ================================================

-- Function to assert caller matches user_id parameter
CREATE OR REPLACE FUNCTION security.assert_caller_is(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid;
BEGIN
  -- Get caller from JWT claim
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid 
  INTO v_caller;
  
  IF v_caller IS NULL OR v_caller <> p_user_id THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
END;
$$;

-- Update existing SECURITY DEFINER functions to use assert_caller_is
CREATE OR REPLACE FUNCTION public.get_google_drive_token_status(p_user_id uuid)
RETURNS TABLE(has_token boolean, expires_at timestamp with time zone, is_expired boolean, dedicated_folder_id text, dedicated_folder_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Guard: verify caller
  PERFORM security.assert_caller_is(p_user_id);
  
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
  
  -- Log the status check (removed log_token_access call as that function doesn't exist)
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_google_drive_access(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  token_exists boolean := false;
  token_expired boolean := true;
BEGIN
  -- Guard: verify caller
  PERFORM security.assert_caller_is(p_user_id);
  
  SELECT 
    (gt.id IS NOT NULL),
    (gt.expires_at < NOW())
  INTO token_exists, token_expired
  FROM google_drive_tokens gt
  WHERE gt.user_id = p_user_id;
  
  RETURN token_exists AND NOT token_expired;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_google_drive_connection_info(p_user_id uuid)
RETURNS TABLE(has_connection boolean, expires_at timestamp with time zone, is_expired boolean, dedicated_folder_id text, dedicated_folder_name text, created_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Guard: verify caller
  PERFORM security.assert_caller_is(p_user_id);
  
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

CREATE OR REPLACE FUNCTION public.get_google_drive_connection_status(p_user_id uuid)
RETURNS TABLE(has_connection boolean, is_expired boolean, dedicated_folder_id text, dedicated_folder_name text, created_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Guard: verify caller
  PERFORM security.assert_caller_is(p_user_id);
  
  -- Return connection information without exposing tokens
  RETURN QUERY
  SELECT 
    true as has_connection,
    (gt.expires_at < NOW()) as is_expired,
    gt.dedicated_folder_id,
    gt.dedicated_folder_name,
    gt.created_at
  FROM google_drive_tokens gt
  WHERE gt.user_id = p_user_id;
END;
$$;

-- ================================================
-- RLS policies for security schema
-- ================================================

-- Deny all direct access to security schema tables
ALTER TABLE security.rate_limit_hits ENABLE ROW LEVEL SECURITY;
ALTER TABLE security.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE security.signature_nonce ENABLE ROW LEVEL SECURITY;

-- No policies = no direct access, only through functions

-- ================================================
-- Cleanup job setup (optional - for periodic maintenance)
-- ================================================

COMMENT ON FUNCTION security.cleanup_expired_nonces() IS 
'Run periodically (e.g., hourly) to clean up expired nonces and old rate limit hits';

-- Grant execute on security functions to authenticated users
GRANT EXECUTE ON FUNCTION security.can_call(uuid, text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION security.consume_nonce_once(text) TO authenticated;
GRANT EXECUTE ON FUNCTION security.assert_caller_is(uuid) TO authenticated;