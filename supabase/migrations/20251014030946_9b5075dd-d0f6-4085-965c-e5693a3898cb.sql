-- 1) Remover duplicatas mantendo a mais recente (se existirem)
WITH ranked AS (
  SELECT ctid, user_id,
         ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY updated_at DESC NULLS LAST) AS rn
  FROM public.user_drive_settings
)
DELETE FROM public.user_drive_settings uds
USING ranked r
WHERE uds.ctid = r.ctid AND r.rn > 1;

WITH ranked AS (
  SELECT ctid, user_id,
         ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY updated_at DESC NULLS LAST) AS rn
  FROM public.drive_sync_state
)
DELETE FROM public.drive_sync_state dss
USING ranked r
WHERE dss.ctid = r.ctid AND r.rn > 1;

-- 2) Criar índices únicos para garantir 1 linha por usuário
CREATE UNIQUE INDEX IF NOT EXISTS user_drive_settings_user_id_key
ON public.user_drive_settings (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS drive_sync_state_user_id_key
ON public.drive_sync_state (user_id);

-- 3) Comentário de documentação
COMMENT ON INDEX user_drive_settings_user_id_key IS 'Garante unicidade: 1 configuração de pasta por usuário. Elimina necessidade de ORDER BY updated_at DESC.';
COMMENT ON INDEX drive_sync_state_user_id_key IS 'Garante unicidade: 1 estado de sync por usuário. Elimina necessidade de ORDER BY updated_at DESC.';