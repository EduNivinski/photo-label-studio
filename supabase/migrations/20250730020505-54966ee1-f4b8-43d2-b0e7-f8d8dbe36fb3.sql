-- Add alias column to photos table
ALTER TABLE public.photos 
ADD COLUMN alias TEXT;