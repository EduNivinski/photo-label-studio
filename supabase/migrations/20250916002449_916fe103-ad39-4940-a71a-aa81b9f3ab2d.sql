-- Flag do usuário para escopo estendido de leitura (download)
ALTER TABLE public.user_drive_settings
  ADD COLUMN IF NOT EXISTS allow_extended_scope boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS scope_granted text NOT NULL DEFAULT '';

-- índice simples para consultas
CREATE INDEX IF NOT EXISTS idx_user_drive_settings_user ON public.user_drive_settings(user_id);