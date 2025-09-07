-- Create private schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS private;

-- Create new user_drive_tokens table with AES-GCM encryption
CREATE TABLE IF NOT EXISTS private.user_drive_tokens (
    user_id UUID PRIMARY KEY,
    encrypted_access_token TEXT NOT NULL,
    encrypted_refresh_token TEXT NOT NULL,
    access_token_nonce TEXT NOT NULL,
    refresh_token_nonce TEXT NOT NULL,
    scope TEXT[] NOT NULL DEFAULT '{}',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_user_drive_tokens_expires_at ON private.user_drive_tokens(expires_at);

-- Create update trigger
CREATE OR REPLACE FUNCTION private.update_user_drive_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_drive_tokens_updated_at
    BEFORE UPDATE ON private.user_drive_tokens
    FOR EACH ROW
    EXECUTE FUNCTION private.update_user_drive_tokens_updated_at();

-- RLS policies for security
ALTER TABLE private.user_drive_tokens ENABLE ROW LEVEL SECURITY;

-- Only service role can access this table (no user access)
CREATE POLICY "Service role only access" ON private.user_drive_tokens
    FOR ALL USING (false);

-- Grant access to service role
GRANT ALL ON private.user_drive_tokens TO service_role;
GRANT USAGE ON SCHEMA private TO service_role;