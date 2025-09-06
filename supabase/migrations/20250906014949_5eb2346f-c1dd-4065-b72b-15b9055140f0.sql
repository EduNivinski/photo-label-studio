-- Create table for Google Drive tokens and settings
CREATE TABLE public.google_drive_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  dedicated_folder_id TEXT,
  dedicated_folder_name TEXT,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.google_drive_tokens ENABLE ROW LEVEL SECURITY;

-- Create policies for Google Drive tokens
CREATE POLICY "Users can create their own google drive tokens" 
ON public.google_drive_tokens 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own google drive tokens" 
ON public.google_drive_tokens 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own google drive tokens" 
ON public.google_drive_tokens 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own google drive tokens" 
ON public.google_drive_tokens 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_google_drive_tokens_updated_at
BEFORE UPDATE ON public.google_drive_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();