-- Clean up duplicate token entries keeping only the most recent one for each user
WITH ranked_tokens AS (
  SELECT *,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
  FROM user_drive_tokens
)
DELETE FROM user_drive_tokens 
WHERE id IN (
  SELECT id FROM ranked_tokens WHERE rn > 1
);

-- Add unique constraint to prevent future duplicates
ALTER TABLE user_drive_tokens 
ADD CONSTRAINT user_drive_tokens_user_id_unique UNIQUE (user_id);