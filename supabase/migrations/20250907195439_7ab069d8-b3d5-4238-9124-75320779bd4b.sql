-- Fix the get_google_drive_tokens_secure function to handle read-only context
CREATE OR REPLACE FUNCTION public.get_google_drive_tokens_secure(p_user_id uuid)
 RETURNS TABLE(access_token text, refresh_token text, expires_at timestamp with time zone, dedicated_folder_id text, dedicated_folder_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    RAISE NOTICE 'Nenhum token encontrado para usuário: %', p_user_id;
    RETURN;
  END IF;
  
  -- Recupera os tokens do vault usando apenas vault.decrypted_secrets
  SELECT decrypted_secret INTO decrypted_access_token
  FROM vault.decrypted_secrets
  WHERE name = 'gd_access_' || p_user_id::text;
  
  SELECT decrypted_secret INTO decrypted_refresh_token
  FROM vault.decrypted_secrets
  WHERE name = 'gd_refresh_' || p_user_id::text;
  
  -- Verifica se os tokens foram recuperados
  IF decrypted_access_token IS NULL OR decrypted_refresh_token IS NULL THEN
    RAISE EXCEPTION 'Tokens não encontrados no vault para usuário: %', p_user_id;
  END IF;
  
  -- Atualiza estatísticas de acesso (only if not in read-only mode)
  BEGIN
    UPDATE google_drive_tokens
    SET access_attempts = access_attempts + 1,
        last_accessed = NOW()
    WHERE user_id = p_user_id;
    
    -- Log do acesso (only if not in read-only mode)
    PERFORM log_token_access(p_user_id, 'TOKEN_ACCESSED_VAULT_SECURE', TRUE);
  EXCEPTION
    WHEN OTHERS THEN
      -- Ignore audit errors in read-only context
      NULL;
  END;
  
  -- Retorna os dados descriptografados
  RETURN QUERY
  SELECT 
    decrypted_access_token,
    decrypted_refresh_token,
    token_record.expires_at,
    token_record.dedicated_folder_id,
    token_record.dedicated_folder_name;
EXCEPTION
  WHEN OTHERS THEN
    -- Try to log error but don't fail if we can't
    BEGIN
      PERFORM log_token_access(p_user_id, 'TOKEN_ACCESS_ERROR', FALSE);
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
    RAISE EXCEPTION 'Erro ao recuperar tokens: %', SQLERRM;
END;
$function$;