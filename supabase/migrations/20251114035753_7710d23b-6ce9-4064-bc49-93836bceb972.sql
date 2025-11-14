-- Create drive_delete_audit table for logging all Drive deletes
CREATE TABLE IF NOT EXISTS drive_delete_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  file_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  bulk_operation_id UUID,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

-- Enable RLS on drive_delete_audit
ALTER TABLE drive_delete_audit ENABLE ROW LEVEL SECURITY;

-- Users can only view their own delete logs
CREATE POLICY "Users can view their own delete logs"
  ON drive_delete_audit FOR SELECT
  USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_drive_delete_audit_user_time 
  ON drive_delete_audit(user_id, deleted_at DESC);

-- Create drive_delete_rate_limit table for rate limiting
CREATE TABLE IF NOT EXISTS drive_delete_rate_limit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for rate limit queries
CREATE INDEX IF NOT EXISTS idx_rate_limit_user_time 
  ON drive_delete_rate_limit(user_id, deleted_at DESC);

-- Function to clean up old rate limit entries (older than 1 minute)
CREATE OR REPLACE FUNCTION cleanup_rate_limit()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM drive_delete_rate_limit 
  WHERE deleted_at < NOW() - INTERVAL '1 minute';
END;
$$;
