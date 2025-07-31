-- Create albums table for smart albums functionality
CREATE TABLE public.albums (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  labels TEXT[] NOT NULL DEFAULT '{}',
  cover_photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.albums ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (following the same pattern as photos and labels)
CREATE POLICY "Albums are publicly readable" 
ON public.albums 
FOR SELECT 
USING (true);

CREATE POLICY "Albums are publicly insertable" 
ON public.albums 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Albums are publicly updatable" 
ON public.albums 
FOR UPDATE 
USING (true);

CREATE POLICY "Albums are publicly deletable" 
ON public.albums 
FOR DELETE 
USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_albums_updated_at
BEFORE UPDATE ON public.albums
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();