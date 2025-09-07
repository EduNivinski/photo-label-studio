-- Enable RLS on the debug table
ALTER TABLE public.gd_token_debug ENABLE ROW LEVEL SECURITY;

-- Only allow authenticated users to view their own debug logs
CREATE POLICY "Users can view their own debug logs" 
ON public.gd_token_debug 
FOR SELECT 
USING (auth.uid() = user_id);

-- Allow system to insert debug logs (for SECURITY DEFINER functions)
CREATE POLICY "System can insert debug logs" 
ON public.gd_token_debug 
FOR INSERT 
WITH CHECK (true);