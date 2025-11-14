-- Enable RLS on drive_delete_rate_limit table
ALTER TABLE drive_delete_rate_limit ENABLE ROW LEVEL SECURITY;

-- Deny all direct access to rate limit table (only edge functions should access it)
CREATE POLICY "Service role only can access rate limit"
  ON drive_delete_rate_limit FOR ALL
  USING (false)
  WITH CHECK (false);
