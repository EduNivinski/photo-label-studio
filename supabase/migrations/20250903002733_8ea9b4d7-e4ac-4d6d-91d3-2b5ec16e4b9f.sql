-- Create a junction table for the N:N relationship between collections and photos
CREATE TABLE public.collection_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  collection_id UUID NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  photo_id UUID NOT NULL REFERENCES public.photos(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(collection_id, photo_id)
);

-- Enable RLS on collection_photos
ALTER TABLE public.collection_photos ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for collection_photos
CREATE POLICY "Users can view their own collection photos"
ON public.collection_photos
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.collections 
    WHERE collections.id = collection_photos.collection_id 
    AND collections.user_id = auth.uid()
  )
);

CREATE POLICY "Users can add photos to their own collections"
ON public.collection_photos
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.collections 
    WHERE collections.id = collection_photos.collection_id 
    AND collections.user_id = auth.uid()
  )
);

CREATE POLICY "Users can remove photos from their own collections"
ON public.collection_photos
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.collections 
    WHERE collections.id = collection_photos.collection_id 
    AND collections.user_id = auth.uid()
  )
);

-- Remove the labels array from collections table since labels will be derived from photos
ALTER TABLE public.collections DROP COLUMN IF EXISTS labels;

-- Add indexes for better performance
CREATE INDEX idx_collection_photos_collection_id ON public.collection_photos(collection_id);
CREATE INDEX idx_collection_photos_photo_id ON public.collection_photos(photo_id);