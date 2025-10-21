-- Add deleted_at column to drive_items for audit trail
ALTER TABLE public.drive_items 
ADD COLUMN deleted_at timestamptz NULL;

-- Add index for querying deleted items
CREATE INDEX idx_drive_items_deleted_at ON public.drive_items(user_id, deleted_at) 
WHERE deleted_at IS NOT NULL;

-- Ensure unique constraint exists for upsert reliability
-- (this may already exist, but ensuring it's there)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'drive_items_user_id_file_id_key'
  ) THEN
    ALTER TABLE public.drive_items 
    ADD CONSTRAINT drive_items_user_id_file_id_key UNIQUE (user_id, file_id);
  END IF;
END $$;