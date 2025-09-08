-- Create the user_drive_tokens table for encrypted storage
CREATE TABLE public.user_drive_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    access_token_enc TEXT NOT NULL,
    refresh_token_enc TEXT NOT NULL,
    scope TEXT NOT NULL DEFAULT '',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.user_drive_tokens ENABLE ROW LEVEL SECURITY;

-- Policy to deny all access to regular users (only service_role can access)
CREATE POLICY "Deny all access to regular users" ON public.user_drive_tokens
AS RESTRICTIVE FOR ALL USING (false);

-- Grant full access to service_role (for edge functions)
GRANT ALL ON public.user_drive_tokens TO service_role;

-- Add index for performance
CREATE INDEX idx_user_drive_tokens_user_id ON public.user_drive_tokens(user_id);
CREATE INDEX idx_user_drive_tokens_expires_at ON public.user_drive_tokens(expires_at);