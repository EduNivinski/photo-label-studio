-- Remove função insegura anterior
DROP FUNCTION IF EXISTS public.store_google_drive_tokens_simple(uuid, text, text, timestamp with time zone, text[]);

-- Habilitar extensão de criptografia
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Função segura para armazenar tokens do Google Drive
CREATE OR REPLACE FUNCTION public.store_google_drive_tokens_secure(
  p_user_id UUID,
  p_access_token TEXT,
  p_refresh_token TEXT,
  p_expires_at TIMESTAMP WITH TIME ZONE,
  p_scopes TEXT[]
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encryption_key TEXT;
BEGIN
  -- Gera uma chave de criptografia única baseada no user_id
  encryption_key := encode(digest(p_user_id::text || 'google_drive_salt_2025', 'sha256'), 'hex');
  
  -- Remove tokens anteriores para este usuário
  DELETE FROM google_drive_tokens WHERE user_id = p_user_id;
  
  -- Insere novo registro com tokens criptografados
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
    gen_random_uuid(), -- Placeholder para secret_id do access_token
    gen_random_uuid(), -- Placeholder para secret_id do refresh_token
    p_expires_at,
    p_scopes,
    NOW(),
    NOW(),
    NOW()
  );
  
  -- Insere tokens criptografados na tabela vault.secrets
  INSERT INTO vault.secrets (secret, name, description, key_id)
  VALUES (
    pgp_sym_encrypt(p_access_token, encryption_key),
    'google_drive_access_token_' || p_user_id::text,
    'Google Drive access token for user ' || p_user_id::text,
    (SELECT key_id FROM vault.secrets WHERE name = 'root' LIMIT 1)
  );
  
  INSERT INTO vault.secrets (secret, name, description, key_id)
  VALUES (
    pgp_sym_encrypt(p_refresh_token, encryption_key),
    'google_drive_refresh_token_' || p_user_id::text,
    'Google Drive refresh token for user ' || p_user_id::text,
    (SELECT key_id FROM vault.secrets WHERE name = 'root' LIMIT 1)
  );
  
  -- Log da operação segura
  PERFORM log_token_access(p_user_id, 'TOKEN_STORED_SECURELY_V2', TRUE);
  
  RAISE NOTICE 'Tokens armazenados de forma segura para o usuário: %', p_user_id;
END;
$$;

-- Função segura para recuperar tokens do Google Drive
CREATE OR REPLACE FUNCTION public.get_google_drive_tokens_secure(p_user_id UUID)
RETURNS TABLE(
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  dedicated_folder_id TEXT,
  dedicated_folder_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  token_record google_drive_tokens%ROWTYPE;
  encryption_key TEXT;
  decrypted_access_token TEXT;
  decrypted_refresh_token TEXT;
BEGIN
  -- Verifica se existe registro para o usuário
  SELECT * INTO token_record
  FROM google_drive_tokens
  WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Gera a chave de descriptografia
  encryption_key := encode(digest(p_user_id::text || 'google_drive_salt_2025', 'sha256'), 'hex');
  
  -- Recupera e descriptografa os tokens
  SELECT pgp_sym_decrypt(secret::bytea, encryption_key) INTO decrypted_access_token
  FROM vault.secrets
  WHERE name = 'google_drive_access_token_' || p_user_id::text;
  
  SELECT pgp_sym_decrypt(secret::bytea, encryption_key) INTO decrypted_refresh_token
  FROM vault.secrets
  WHERE name = 'google_drive_refresh_token_' || p_user_id::text;
  
  -- Atualiza estatísticas de acesso
  UPDATE google_drive_tokens
  SET access_attempts = access_attempts + 1,
      last_accessed = NOW()
  WHERE user_id = p_user_id;
  
  -- Log do acesso
  PERFORM log_token_access(p_user_id, 'TOKEN_ACCESSED_SECURELY_V2', TRUE);
  
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

-- Conceder permissões para usuários autenticados
GRANT EXECUTE ON FUNCTION public.store_google_drive_tokens_secure(UUID, TEXT, TEXT, TIMESTAMP WITH TIME ZONE, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_google_drive_tokens_secure(UUID) TO authenticated;

-- Função para limpar tokens expirados (limpeza automática)
CREATE OR REPLACE FUNCTION public.cleanup_expired_google_drive_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Remove tokens expirados há mais de 24 horas
  DELETE FROM vault.secrets
  WHERE name LIKE 'google_drive_%_token_%'
  AND created_at < NOW() - INTERVAL '24 hours'
  AND EXISTS (
    SELECT 1 FROM google_drive_tokens gt
    WHERE (name = 'google_drive_access_token_' || gt.user_id::text
           OR name = 'google_drive_refresh_token_' || gt.user_id::text)
    AND gt.expires_at < NOW() - INTERVAL '24 hours'
  );
  
  -- Remove registros da tabela principal
  DELETE FROM google_drive_tokens
  WHERE expires_at < NOW() - INTERVAL '24 hours';
END;
$$;