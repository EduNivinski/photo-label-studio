-- Schema privado
CREATE SCHEMA IF NOT EXISTS private;

-- Tabela de tokens cifrados (base64)
CREATE TABLE IF NOT EXISTS private.user_drive_tokens (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token_enc text NOT NULL,
  refresh_token_enc text NOT NULL,
  scope text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: negar tudo
ALTER TABLE private.user_drive_tokens ENABLE ROW LEVEL SECURITY;

-- Criar política deny_all se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='private' AND tablename='user_drive_tokens' AND policyname='deny_all'
  ) THEN
    CREATE POLICY deny_all ON private.user_drive_tokens
      FOR ALL USING (false) WITH CHECK (false);
  END IF;
END $$;

-- Permissões para a Edge Function (service_role)
GRANT USAGE ON SCHEMA private TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON private.user_drive_tokens TO service_role;