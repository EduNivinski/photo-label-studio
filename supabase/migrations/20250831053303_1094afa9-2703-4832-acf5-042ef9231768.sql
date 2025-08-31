-- Add original_date column to photos table to store EXIF date
ALTER TABLE public.photos ADD COLUMN original_date timestamp with time zone;