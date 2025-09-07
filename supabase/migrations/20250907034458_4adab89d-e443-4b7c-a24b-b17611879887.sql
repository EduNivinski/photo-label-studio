-- Corrigir função store_google_drive_tokens_secure com ordem correta dos parâmetros
DROP FUNCTION IF EXISTS public.store_google_drive_tokens_secure(uuid, text, text, timestamp with time zone, text[]);

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

  -- Cria/rotaciona o secret do access token (ORDEM CORRIGIDA: secret, name, description)
  SELECT vault.create_secret(
    p_access_token,        -- new_secret (1º parâmetro)
    access_name,           -- new_name (2º parâmetro)  
    'Google Drive access token'  -- new_description (3º parâmetro)
  ) INTO access_secret_id;

  -- Cria/rotaciona o secret do refresh token
  SELECT vault.create_secret(
    p_refresh_token,       -- new_secret (1º parâmetro)
    refresh_name,          -- new_name (2º parâmetro)
    'Google Drive refresh token'  -- new_description (3º parâmetro)
  ) INTO refresh_secret_id;

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