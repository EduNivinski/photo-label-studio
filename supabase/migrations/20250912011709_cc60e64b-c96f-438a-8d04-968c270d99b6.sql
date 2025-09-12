-- Pasta dedicada do app por usuário
CREATE TABLE IF NOT EXISTS public.user_drive_meta (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  dedicated_folder_id text NOT NULL,
  dedicated_folder_name text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS e permissões (deny-all; service_role-only)
ALTER TABLE public.user_drive_meta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS deny_all_user_drive_meta ON public.user_drive_meta;
CREATE POLICY deny_all_user_drive_meta
ON public.user_drive_meta
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

REVOKE ALL ON public.user_drive_meta FROM anon, authenticated;
GRANT ALL ON public.user_drive_meta TO service_role;

-- Índices úteis
CREATE INDEX IF NOT EXISTS idx_user_drive_meta_user_id ON public.user_drive_meta(user_id);