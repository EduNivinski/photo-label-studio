-- Deduplicate user_drive_settings by user_id, keep the most recent updated_at
WITH ranked AS (
  SELECT ctid, user_id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id 
           ORDER BY updated_at DESC NULLS LAST
         ) AS rn
  FROM public.user_drive_settings
)
DELETE FROM public.user_drive_settings uds
USING ranked r
WHERE uds.ctid = r.ctid AND r.rn > 1;

-- Ensure a unique row per user in user_drive_settings
CREATE UNIQUE INDEX IF NOT EXISTS user_drive_settings_user_id_key
ON public.user_drive_settings (user_id);

-- (Optional hardening) Ensure a unique row per user in drive_sync_state
CREATE UNIQUE INDEX IF NOT EXISTS drive_sync_state_user_id_key
ON public.drive_sync_state (user_id);
