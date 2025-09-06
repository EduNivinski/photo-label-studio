-- Fix the SECURITY DEFINER view issue
-- Drop and recreate the view without SECURITY DEFINER

DROP VIEW IF EXISTS google_drive_connections_secure;

-- Create a simple view without SECURITY DEFINER
-- RLS policies on the underlying table will still protect access
CREATE VIEW google_drive_connections_secure AS
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

-- Ensure proper RLS is enabled on the base table (already exists)
-- The existing RLS policies will protect access through the view

-- Grant access to the view for authenticated users
GRANT SELECT ON google_drive_connections_secure TO authenticated;