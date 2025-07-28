-- Create photos table
CREATE TABLE public.photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  url TEXT NOT NULL,
  name TEXT NOT NULL,
  upload_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  labels TEXT[] DEFAULT '{}'::TEXT[]
);

-- Create labels table  
CREATE TABLE public.labels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT
);

-- Enable Row Level Security
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labels ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (adjust these based on your auth requirements)
CREATE POLICY "Photos are publicly readable" 
ON public.photos 
FOR SELECT 
USING (true);

CREATE POLICY "Photos are publicly insertable" 
ON public.photos 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Photos are publicly updatable" 
ON public.photos 
FOR UPDATE 
USING (true);

CREATE POLICY "Photos are publicly deletable" 
ON public.photos 
FOR DELETE 
USING (true);

CREATE POLICY "Labels are publicly readable" 
ON public.labels 
FOR SELECT 
USING (true);

CREATE POLICY "Labels are publicly insertable" 
ON public.labels 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Labels are publicly updatable" 
ON public.labels 
FOR UPDATE 
USING (true);

CREATE POLICY "Labels are publicly deletable" 
ON public.labels 
FOR DELETE 
USING (true);

-- Create storage bucket for photos
INSERT INTO storage.buckets (id, name, public) VALUES ('photos', 'photos', true);

-- Create storage policies
CREATE POLICY "Photo files are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'photos');

CREATE POLICY "Anyone can upload photo files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'photos');

CREATE POLICY "Anyone can update photo files" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'photos');

CREATE POLICY "Anyone can delete photo files" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'photos');

-- Enable realtime for both tables
ALTER TABLE public.photos REPLICA IDENTITY FULL;
ALTER TABLE public.labels REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.photos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.labels;