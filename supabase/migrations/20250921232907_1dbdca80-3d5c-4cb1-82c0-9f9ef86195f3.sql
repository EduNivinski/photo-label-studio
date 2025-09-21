-- Create storage bucket for preview cache
INSERT INTO storage.buckets (id, name, public) VALUES ('previews', 'previews', false);

-- Create RLS policies for previews bucket
CREATE POLICY "Users can view their own previews" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'previews' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own previews" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'previews' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own previews" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'previews' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own previews" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'previews' AND auth.uid()::text = (storage.foldername(name))[1]);