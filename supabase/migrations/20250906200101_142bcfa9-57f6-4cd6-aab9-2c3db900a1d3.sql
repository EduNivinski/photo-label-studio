-- Fix the remaining security issues with the view

-- Drop the view and recreate it as a simple table alias to avoid SECURITY DEFINER issues
DROP VIEW IF EXISTS google_drive_connections_secure;

-- Instead of a view, let's just ensure the main table is properly protected
-- and users access it directly with proper RLS

-- Verify RLS is enabled on the main table (should already be enabled)
ALTER TABLE google_drive_tokens ENABLE ROW LEVEL SECURITY;

-- Ensure existing RLS policies are comprehensive
-- (These should already exist, but let's make sure)

-- Policy for users to view their own tokens
DROP POLICY IF EXISTS "Users can view their own google drive tokens" ON google_drive_tokens;
CREATE POLICY "Users can view their own google drive tokens" 
ON google_drive_tokens 
FOR SELECT 
USING (auth.uid() = user_id);

-- Policy for users to create their own tokens
DROP POLICY IF EXISTS "Users can create their own google drive tokens" ON google_drive_tokens;
CREATE POLICY "Users can create their own google drive tokens" 
ON google_drive_tokens 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Policy for users to update their own tokens
DROP POLICY IF EXISTS "Users can update their own google drive tokens" ON google_drive_tokens;
CREATE POLICY "Users can update their own google drive tokens" 
ON google_drive_tokens 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy for users to delete their own tokens
DROP POLICY IF EXISTS "Users can delete their own google drive tokens" ON google_drive_tokens;
CREATE POLICY "Users can delete their own google drive tokens" 
ON google_drive_tokens 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create a simple function that returns secure token info instead of a view
CREATE OR REPLACE FUNCTION get_my_google_drive_status()
RETURNS TABLE (
    token_status TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    dedicated_folder_id TEXT,
    dedicated_folder_name TEXT,
    last_accessed TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'ENCRYPTED'::TEXT as token_status,
        gt.expires_at,
        gt.dedicated_folder_id,
        gt.dedicated_folder_name,
        gt.last_accessed,
        gt.created_at
    FROM google_drive_tokens gt
    WHERE gt.user_id = auth.uid();
END;
$$;

-- Grant access to the function
GRANT EXECUTE ON FUNCTION get_my_google_drive_status() TO authenticated;