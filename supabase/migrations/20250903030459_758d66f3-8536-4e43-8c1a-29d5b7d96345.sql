-- Add media_type column to photos table to distinguish between photos and videos
ALTER TABLE public.photos 
ADD COLUMN media_type TEXT NOT NULL DEFAULT 'photo' CHECK (media_type IN ('photo', 'video'));