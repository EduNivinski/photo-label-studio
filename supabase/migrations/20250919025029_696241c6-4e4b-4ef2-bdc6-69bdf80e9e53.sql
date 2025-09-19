-- Add video metadata columns to drive_items if they don't exist
ALTER TABLE public.drive_items 
  ADD COLUMN IF NOT EXISTS video_duration_ms bigint,
  ADD COLUMN IF NOT EXISTS video_width integer,
  ADD COLUMN IF NOT EXISTS video_height integer;