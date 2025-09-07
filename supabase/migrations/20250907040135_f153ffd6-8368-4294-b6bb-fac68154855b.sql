-- Criar tabela de debug (sem tokens)
CREATE TABLE IF NOT EXISTS public.gd_token_debug (
  id bigserial primary key,
  user_id uuid,
  step text,
  ok boolean,
  sqlstate text,
  err text,
  at timestamptz default now()
);

-- Helper para inserção no log (evita duplicação)
CREATE OR REPLACE FUNCTION public.gd_token_debug_insert(
  p_user_id uuid, p_step text, p_ok boolean, p_sqlstate text, p_err text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.gd_token_debug(user_id, step, ok, sqlstate, err)
  VALUES (p_user_id, p_step, p_ok, p_sqlstate, p_err);
END;
$$;

-- Atualizar a função com logs detalhados (sem expor tokens)
CREATE OR REPLACE FUNCTION public.store_google_drive_tokens_secure(
  p_user_id uuid,
  p_access_token text,
  p_refresh_token text,
  p_expires_at timestamptz,
  p_scopes text[]
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path='public'
AS $$
DECLARE
  access_secret_id uuid;
  refresh_secret_id uuid;
  access_name text := 'gd_access_' || p_user_id::text;
  refresh_name text := 'gd_refresh_' || p_user_id::text;
BEGIN
  PERFORM public.gd_token_debug_insert(p_user_id, 'BEGIN', TRUE, NULL, NULL);

  -- 1) apaga metadados antigos
  PERFORM public.gd_token_debug_insert(p_user_id, 'DELETE google_drive_tokens', TRUE, NULL, NULL);
  DELETE FROM public.google_drive_tokens WHERE user_id = p_user_id;

  -- 2) checar se já existe secret com esse nome
  PERFORM public.gd_token_debug_insert(p_user_id, 'CHECK existing secrets', TRUE, NULL, NULL);

  -- 3) criar/rotacionar access secret
  PERFORM public.gd_token_debug_insert(p_user_id, 'CREATE_SECRET access (before)', TRUE, NULL, NULL);
  SELECT id INTO access_secret_id
  FROM vault.create_secret(p_access_token, access_name, 'Google Drive access token');
  PERFORM public.gd_token_debug_insert(p_user_id, 'CREATE_SECRET access (after)', TRUE, NULL, NULL);

  -- 4) criar/rotacionar refresh secret
  PERFORM public.gd_token_debug_insert(p_user_id, 'CREATE_SECRET refresh (before)', TRUE, NULL, NULL);
  SELECT id INTO refresh_secret_id
  FROM vault.create_secret(p_refresh_token, refresh_name, 'Google Drive refresh token');
  PERFORM public.gd_token_debug_insert(p_user_id, 'CREATE_SECRET refresh (after)', TRUE, NULL, NULL);

  IF access_secret_id IS NULL OR refresh_secret_id IS NULL THEN
    PERFORM public.gd_token_debug_insert(p_user_id, 'SECRET_ID NULL', FALSE, NULL, 'ids nulos');
    RAISE EXCEPTION 'Falha ao criar/rotacionar secrets';
  END IF;

  -- 5) inserir metadados
  PERFORM public.gd_token_debug_insert(p_user_id, 'INSERT google_drive_tokens (before)', TRUE, NULL, NULL);
  INSERT INTO public.google_drive_tokens (
    user_id,
    access_token_secret_id,
    refresh_token_secret_id,
    expires_at,
    scopes,
    token_last_rotated,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    access_secret_id,
    refresh_secret_id,
    p_expires_at,
    p_scopes,
    NOW(),
    NOW(),
    NOW()
  );
  PERFORM public.gd_token_debug_insert(p_user_id, 'INSERT google_drive_tokens (after)', TRUE, NULL, NULL);

  PERFORM public.gd_token_debug_insert(p_user_id, 'END OK', TRUE, NULL, NULL);
  RETURN;

EXCEPTION WHEN OTHERS THEN
  -- captura SQLSTATE sem expor detalhes ao usuário final
  PERFORM public.gd_token_debug_insert(p_user_id, 'EXCEPTION', FALSE, SQLSTATE, NULL);
  RAISE EXCEPTION 'Erro ao armazenar tokens de forma segura';
END;
$$;