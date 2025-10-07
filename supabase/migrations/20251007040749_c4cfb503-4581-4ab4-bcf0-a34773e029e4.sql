-- =============================================
-- Security Hardening: Correct Grants & Legacy Signature TTL
-- =============================================

-- 1) Grant EXECUTE only to service_role (not authenticated)
--    Edge functions use service role key to call these
GRANT EXECUTE ON FUNCTION security.can_call(uuid, text, text, integer, integer) 
  TO service_role;

GRANT EXECUTE ON FUNCTION security.consume_nonce_once(text) 
  TO service_role;

GRANT EXECUTE ON FUNCTION security.cleanup_expired_nonces() 
  TO service_role;

-- Revoke any previous grants to authenticated (fail closed security)
REVOKE EXECUTE ON FUNCTION security.can_call(uuid, text, text, integer, integer) 
  FROM authenticated;

REVOKE EXECUTE ON FUNCTION security.consume_nonce_once(text) 
  FROM authenticated;

-- 2) Create table to track first seen time for legacy signatures
--    This enables 1-hour TTL even for signatures without exp field
CREATE TABLE IF NOT EXISTS security.legacy_sig_seen (
  sig TEXT PRIMARY KEY,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_legacy_sig_seen_first_seen 
  ON security.legacy_sig_seen(first_seen);

-- 3) Function to record and retrieve first seen time for legacy signature
CREATE OR REPLACE FUNCTION security.legacy_sig_first_seen(p_sig TEXT)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = security
AS $$
DECLARE
  v_first_seen TIMESTAMPTZ;
BEGIN
  -- Insert if not exists (idempotent)
  INSERT INTO security.legacy_sig_seen(sig)
  VALUES (p_sig)
  ON CONFLICT (sig) DO NOTHING;

  -- Return the first seen time
  SELECT first_seen INTO v_first_seen
  FROM security.legacy_sig_seen
  WHERE sig = p_sig;

  RETURN v_first_seen;
END;
$$;

-- Grant to service_role
GRANT EXECUTE ON FUNCTION security.legacy_sig_first_seen(TEXT) 
  TO service_role;

-- 4) Cleanup function for old legacy signature records (run periodically)
CREATE OR REPLACE FUNCTION security.cleanup_legacy_signatures(p_older_than_hours INTEGER DEFAULT 2)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = security
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM security.legacy_sig_seen
  WHERE first_seen < now() - (p_older_than_hours || ' hours')::INTERVAL;
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

GRANT EXECUTE ON FUNCTION security.cleanup_legacy_signatures(INTEGER) 
  TO service_role;

-- 5) Add comment for documentation
COMMENT ON SCHEMA security IS 
  'Security-owned objects (rate limit, events, nonces, legacy signatures). Access only via SECURITY DEFINER functions with service_role.';

COMMENT ON TABLE security.legacy_sig_seen IS 
  'Tracks first seen timestamp for legacy thumbnail signatures to enforce 1-hour TTL';

COMMENT ON FUNCTION security.legacy_sig_first_seen(TEXT) IS 
  'Records and returns first seen time for legacy signature. Used to enforce TTL even without embedded exp field.';