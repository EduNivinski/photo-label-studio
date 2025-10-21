-- Add thumbnail cache fields to drive_items
ALTER TABLE public.drive_items
  ADD COLUMN IF NOT EXISTS thumb_url text,
  ADD COLUMN IF NOT EXISTS thumb_rev text,
  ADD COLUMN IF NOT EXISTS thumb_updated_at timestamptz;

-- Create thumbnails storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('thumbnails', 'thumbnails', true, 5242880, ARRAY['image/webp', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies for thumbnails bucket
CREATE POLICY "Users can view their own thumbnails"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'thumbnails' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Service role can manage all thumbnails"
  ON storage.objects FOR ALL
  USING (bucket_id = 'thumbnails')
  WITH CHECK (bucket_id = 'thumbnails');