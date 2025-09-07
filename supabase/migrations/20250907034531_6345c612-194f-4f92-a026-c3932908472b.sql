-- Corrigir cleanup_expired_google_drive_tokens_safe com ordem correta dos parâmetros
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

    -- Rotaciona para vazio (ordem corrigida: secret, name, description)
    PERFORM vault.create_secret('', access_name, 'Rotate to empty');
    PERFORM vault.create_secret('', refresh_name, 'Rotate to empty');

    PERFORM log_token_access(r.user_id, 'EXPIRED_TOKENS_ROTATED', TRUE);
  END LOOP;

  DELETE FROM google_drive_tokens
  WHERE expires_at < NOW() - INTERVAL '24 hours';
END;
$$;