-- FASE 1: Add drive_origin_folder and collections columns

-- Add columns to photos table
ALTER TABLE photos 
ADD COLUMN IF NOT EXISTS drive_origin_folder TEXT,
ADD COLUMN IF NOT EXISTS collections TEXT[] DEFAULT '{}';

-- Add columns to drive_items table
ALTER TABLE drive_items
ADD COLUMN IF NOT EXISTS drive_origin_folder TEXT,
ADD COLUMN IF NOT EXISTS collections TEXT[] DEFAULT '{}';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_photos_drive_origin ON photos(drive_origin_folder) WHERE drive_origin_folder IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_drive_items_origin ON drive_items(drive_origin_folder) WHERE drive_origin_folder IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_photos_collections ON photos USING GIN(collections);
CREATE INDEX IF NOT EXISTS idx_drive_items_collections ON drive_items USING GIN(collections);

-- Populate drive_origin_folder for existing drive_items based on path_cached
UPDATE drive_items 
SET drive_origin_folder = (
  SELECT CASE 
    WHEN path_cached IS NULL OR path_cached = '' THEN NULL
    ELSE split_part(path_cached, '/', -1)
  END
)
WHERE drive_origin_folder IS NULL 
  AND path_cached IS NOT NULL 
  AND path_cached != '';

-- Add comment explaining the columns
COMMENT ON COLUMN photos.drive_origin_folder IS 'Pasta de origem no Google Drive (gerenciado automaticamente pelo sistema)';
COMMENT ON COLUMN photos.collections IS 'Collections criadas manualmente pelo usuário';
COMMENT ON COLUMN drive_items.drive_origin_folder IS 'Pasta de origem no Google Drive (gerenciado automaticamente pelo sistema)';
COMMENT ON COLUMN drive_items.collections IS 'Collections criadas manualmente pelo usuário';