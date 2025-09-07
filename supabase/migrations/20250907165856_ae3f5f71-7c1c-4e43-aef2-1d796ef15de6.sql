-- Criar função temporária de debug para verificar tokens
CREATE OR REPLACE FUNCTION public.debug_google_drive_tokens(p_user_id uuid)
RETURNS TABLE(
  vault_access_exists boolean,
  vault_refresh_exists boolean,
  access_preview text,
  refresh_preview text,
  expires_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  access_secret text;
  refresh_secret text;
  token_record google_drive_tokens%ROWTYPE;
BEGIN
  -- Pegar registro da tabela principal
  SELECT * INTO token_record
  FROM google_drive_tokens
  WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Verificar se existem secrets no vault
  SELECT decrypted_secret INTO access_secret
  FROM vault.decrypted_secrets
  WHERE name = 'gd_access_' || p_user_id::text;
  
  SELECT decrypted_secret INTO refresh_secret
  FROM vault.decrypted_secrets
  WHERE name = 'gd_refresh_' || p_user_id::text;
  
  RETURN QUERY
  SELECT 
    (access_secret IS NOT NULL),
    (refresh_secret IS NOT NULL),
    CASE WHEN access_secret IS NOT NULL 
         THEN LEFT(access_secret, 20) || '...' 
         ELSE NULL END,
    CASE WHEN refresh_secret IS NOT NULL 
         THEN LEFT(refresh_secret, 20) || '...' 
         ELSE NULL END,
    token_record.expires_at;
END;
$function$;