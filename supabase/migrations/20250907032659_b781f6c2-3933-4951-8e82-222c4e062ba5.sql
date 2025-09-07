-- DROP da versão antiga
DROP FUNCTION IF EXISTS public.store_google_drive_tokens_secure(uuid, text, text, timestamp with time zone, text[]);

-- Função de armazenamento (sem DELETEs diretos no schema vault)
CREATE OR REPLACE FUNCTION public.store_google_drive_tokens_secure(
  p_user_id uuid, 
  p_access_token text, 
  p_refresh_token text, 
  p_expires_at timestamp with time zone, 
  p_scopes text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  access_secret_id uuid;
  refresh_secret_id uuid;
  access_name text := 'gd_access_' || p_user_id::text;
  refresh_name text := 'gd_refresh_' || p_user_id::text;
BEGIN
  -- Apaga registro antigo do usuário (metadados), mas NÃO mexe direto no schema vault
  DELETE FROM google_drive_tokens WHERE user_id = p_user_id;

  -- Cria/rotaciona o secret do access token (AJUSTE a ordem conforme a assinatura real!)
  SELECT id INTO access_secret_id
  FROM vault.create_secret(
    access_name,      -- name
    p_access_token,   -- secret
    'Google Drive access token'  -- description
  );

  -- Cria/rotaciona o secret do refresh token
  SELECT id INTO refresh_secret_id
  FROM vault.create_secret(
    refresh_name,       -- name
    p_refresh_token,    -- secret
    'Google Drive refresh token'
  );

  IF access_secret_id IS NULL OR refresh_secret_id IS NULL THEN
    PERFORM log_token_access(p_user_id, 'TOKEN_VAULT_CREATE_NULL', FALSE);
    RAISE EXCEPTION 'Falha ao criar/rotacionar secrets no Vault';
  END IF;

  INSERT INTO google_drive_tokens (
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

  PERFORM log_token_access(p_user_id, 'TOKEN_STORED_VAULT_SECURE', TRUE);

EXCEPTION
  WHEN OTHERS THEN
    -- Não expor erro interno
    PERFORM log_token_access(p_user_id, 'TOKEN_STORAGE_ERROR', FALSE);
    RAISE EXCEPTION 'Erro ao armazenar tokens de forma segura';
END;
$$;

-- Verificação de disponibilidade do Vault (sem pgcrypto)
CREATE OR REPLACE FUNCTION public.check_vault_availability()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Apenas verifica acesso de leitura às views do Vault; não cria/deleta nada aqui
  PERFORM 1 FROM vault.decrypted_secrets LIMIT 1;
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$;

-- Limpeza segura (sem DELETE direto no vault; prefira rotacionar para valor vazio OU usar vault.delete_secret(name) se existir)
-- Se existir vault.delete_secret(name text), use-a; caso contrário, SKIP ou apenas remova metadados.
CREATE OR REPLACE FUNCTION public.cleanup_expired_google_drive_tokens_safe()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  r RECORD;
  access_name text;
  refresh_name text;
BEGIN
  FOR r IN
    SELECT user_id
    FROM google_drive_tokens
    WHERE expires_at < NOW() - INTERVAL '24 hours'
  LOOP
    access_name := 'gd_access_' || r.user_id::text;
    refresh_name := 'gd_refresh_' || r.user_id::text;

    -- Tente deletar via função (se existir), senão apenas rotacione para valor vazio:
    -- Exemplo (comente/descomente conforme disponibilidade):
    -- PERFORM vault.delete_secret(access_name);
    -- PERFORM vault.delete_secret(refresh_name);

    -- Fallback: rotaciona para vazio (não ideal, mas evita DELETE direto no schema)
    PERFORM (SELECT id FROM vault.create_secret(access_name, '', 'Rotate to empty'));
    PERFORM (SELECT id FROM vault.create_secret(refresh_name, '', 'Rotate to empty'));

    PERFORM log_token_access(r.user_id, 'EXPIRED_TOKENS_ROTATED', TRUE);
  END LOOP;

  DELETE FROM google_drive_tokens
  WHERE expires_at < NOW() - INTERVAL '24 hours';
END;
$$;