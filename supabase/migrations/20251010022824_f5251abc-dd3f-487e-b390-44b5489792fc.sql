-- Criar tabela para gerenciar estados OAuth
CREATE TABLE IF NOT EXISTS public.oauth_state (
  state TEXT PRIMARY KEY,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL DEFAULT 'google',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: bloquear acesso direto (apenas via service role nas edge functions)
ALTER TABLE public.oauth_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deny_all_oauth_state"
  ON public.oauth_state
  FOR ALL
  USING (FALSE)
  WITH CHECK (FALSE);

-- Criar função para limpar estados expirados (job de limpeza)
CREATE OR REPLACE FUNCTION public.cleanup_expired_oauth_states()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.oauth_state
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Função para armazenar tokens do Google Drive (idempotente)
CREATE OR REPLACE FUNCTION public.store_google_drive_tokens(
  p_user_id UUID,
  p_access_token TEXT,
  p_refresh_token TEXT,
  p_expires_in INTEGER,
  p_scope TEXT DEFAULT ''
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Usar upsert para evitar duplicação
  INSERT INTO public.user_drive_tokens (
    user_id,
    access_token_enc,
    refresh_token_enc,
    expires_at,
    scope,
    updated_at
  )
  VALUES (
    p_user_id,
    p_access_token, -- será criptografado pela edge function
    COALESCE(p_refresh_token, ''),
    NOW() + MAKE_INTERVAL(secs => p_expires_in),
    p_scope,
    NOW()
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    access_token_enc = EXCLUDED.access_token_enc,
    refresh_token_enc = COALESCE(NULLIF(EXCLUDED.refresh_token_enc, ''), user_drive_tokens.refresh_token_enc),
    expires_at = EXCLUDED.expires_at,
    scope = EXCLUDED.scope,
    updated_at = NOW();
END;
$$;