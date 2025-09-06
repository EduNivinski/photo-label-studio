-- Corrigir as funções de criptografia do Google Drive para evitar o erro digest
DROP FUNCTION IF EXISTS public.store_google_drive_tokens_secure(uuid, text, text, timestamp with time zone, text[]);
DROP FUNCTION IF EXISTS public.get_google_drive_tokens_secure(uuid);

-- Função para armazenar tokens de forma segura usando a vault do Supabase
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
SET search_path TO 'public'
AS $$
DECLARE
  access_secret_id uuid;
  refresh_secret_id uuid;
BEGIN
  -- Remove tokens anteriores para este usuário
  DELETE FROM google_drive_tokens WHERE user_id = p_user_id;
  
  -- Remove secrets antigos se existirem
  DELETE FROM vault.secrets 
  WHERE name IN (
    'gd_access_' || p_user_id::text,
    'gd_refresh_' || p_user_id::text
  );
  
  -- Armazena o access token no vault
  INSERT INTO vault.secrets (secret, name, description)
  VALUES (p_access_token, 'gd_access_' || p_user_id::text, 'Google Drive access token')
  RETURNING id INTO access_secret_id;
  
  -- Armazena o refresh token no vault
  INSERT INTO vault.secrets (secret, name, description)
  VALUES (p_refresh_token, 'gd_refresh_' || p_user_id::text, 'Google Drive refresh token')
  RETURNING id INTO refresh_secret_id;
  
  -- Insere novo registro na tabela principal
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
  
  -- Log da operação segura
  PERFORM log_token_access(p_user_id, 'TOKEN_STORED_VAULT', TRUE);
  
  RAISE NOTICE 'Tokens armazenados com segurança no vault para usuário: %', p_user_id;
END;
$$;

-- Função para recuperar tokens de forma segura
CREATE OR REPLACE FUNCTION public.get_google_drive_tokens_secure(p_user_id uuid)
RETURNS TABLE(
  access_token text, 
  refresh_token text, 
  expires_at timestamp with time zone, 
  dedicated_folder_id text, 
  dedicated_folder_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  token_record google_drive_tokens%ROWTYPE;
  decrypted_access_token text;
  decrypted_refresh_token text;
BEGIN
  -- Verifica se existe registro para o usuário
  SELECT * INTO token_record
  FROM google_drive_tokens
  WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Recupera os tokens do vault
  SELECT decrypted_secret INTO decrypted_access_token
  FROM vault.decrypted_secrets
  WHERE name = 'gd_access_' || p_user_id::text;
  
  SELECT decrypted_secret INTO decrypted_refresh_token
  FROM vault.decrypted_secrets
  WHERE name = 'gd_refresh_' || p_user_id::text;
  
  -- Atualiza estatísticas de acesso
  UPDATE google_drive_tokens
  SET access_attempts = access_attempts + 1,
      last_accessed = NOW()
  WHERE user_id = p_user_id;
  
  -- Log do acesso
  PERFORM log_token_access(p_user_id, 'TOKEN_ACCESSED_VAULT', TRUE);
  
  -- Retorna os dados descriptografados
  RETURN QUERY
  SELECT 
    decrypted_access_token,
    decrypted_refresh_token,
    token_record.expires_at,
    token_record.dedicated_folder_id,
    token_record.dedicated_folder_name;
END;
$$;

-- Conceder permissões
GRANT EXECUTE ON FUNCTION public.store_google_drive_tokens_secure(uuid, text, text, timestamp with time zone, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_google_drive_tokens_secure(uuid) TO authenticated;