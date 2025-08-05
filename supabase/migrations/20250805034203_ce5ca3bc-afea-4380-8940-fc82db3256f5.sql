-- Rename albums table to collections
ALTER TABLE public.albums RENAME TO collections;

-- Update any references or constraints if needed
-- (Note: Since we're just renaming, most constraints and indexes should be preserved)