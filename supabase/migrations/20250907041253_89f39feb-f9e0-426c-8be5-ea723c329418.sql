-- Corrigir problemas de segurança identificados no scan

-- 1. Restringir acesso aos logs de debug para administradores apenas
DROP POLICY IF EXISTS "System can insert debug logs" ON gd_token_debug;
DROP POLICY IF EXISTS "Users can view their own debug logs" ON gd_token_debug;

-- Criar políticas mais restritivas para debug logs
CREATE POLICY "System can insert debug logs (restricted)" 
ON gd_token_debug 
FOR INSERT 
TO service_role 
WITH CHECK (true);

CREATE POLICY "Admins can view debug logs" 
ON gd_token_debug 
FOR SELECT 
TO service_role 
USING (true);

-- 2. Permitir acesso de auditoria para administradores de segurança
DROP POLICY IF EXISTS "Audit logs are viewable by system only" ON google_drive_token_audit;

CREATE POLICY "Security admins can view audit logs" 
ON google_drive_token_audit 
FOR SELECT 
TO service_role 
USING (true);

-- Para usuários autenticados, apenas seus próprios logs
CREATE POLICY "Users can view their own audit logs" 
ON google_drive_token_audit 
FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- 3. Corrigir search_path nas funções para segurança
CREATE OR REPLACE FUNCTION public.store_google_drive_tokens_simple(
  p_user_id uuid,
  p_access_token_secret_id uuid,
  p_refresh_token_secret_id uuid,
  p_expires_at timestamp with time zone,
  p_scopes text[]
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'  -- Fixed: explicitly set search_path
AS $$
BEGIN
  -- Remove registros antigos do usuário
  DELETE FROM public.google_drive_tokens WHERE user_id = p_user_id;

  -- Inserir novos metadados com secret IDs já criados
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
    p_access_token_secret_id,
    p_refresh_token_secret_id,
    p_expires_at,
    p_scopes,
    NOW(),
    NOW(),
    NOW()
  );

  -- Log de sucesso
  PERFORM log_token_access(p_user_id, 'TOKEN_STORED_SIMPLE', TRUE);

EXCEPTION WHEN OTHERS THEN
  -- Log de erro
  PERFORM log_token_access(p_user_id, 'TOKEN_STORAGE_ERROR_SIMPLE', FALSE);
  RAISE EXCEPTION 'Erro ao armazenar metadados dos tokens';
END;
$$;

-- 4. Corrigir outras funções com search_path
CREATE OR REPLACE FUNCTION public.log_token_access(
  p_user_id uuid, 
  p_action text, 
  p_success boolean DEFAULT true
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'  -- Fixed: explicitly set search_path
AS $$
BEGIN
  INSERT INTO public.google_drive_token_audit (user_id, action, success)
  VALUES (p_user_id, p_action, p_success);
END;
$$;

CREATE OR REPLACE FUNCTION public.gd_token_debug_insert(
  p_user_id uuid, 
  p_step text, 
  p_ok boolean, 
  p_sqlstate text, 
  p_err text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'  -- Fixed: explicitly set search_path
AS $$
BEGIN
  INSERT INTO public.gd_token_debug(user_id, step, ok, sqlstate, err)
  VALUES (p_user_id, p_step, p_ok, p_sqlstate, p_err);
END;
$$;

-- 5. Criar função para sanitização de dados sensíveis nos logs
CREATE OR REPLACE FUNCTION public.sanitize_sensitive_data(
  p_input text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Remove tokens, senhas, e outros dados sensíveis dos logs
  RETURN regexp_replace(
    regexp_replace(
      regexp_replace(
        p_input,
        'token["\s]*[:=]["\s]*[a-zA-Z0-9._-]+',
        'token: [REDACTED]',
        'gi'
      ),
      'password["\s]*[:=]["\s]*[^"\s,}]+',
      'password: [REDACTED]',
      'gi'
    ),
    'secret["\s]*[:=]["\s]*[a-zA-Z0-9._-]+',
    'secret: [REDACTED]',
    'gi'
  );
END;
$$;

-- 6. Criar função para verificação de integridade de segurança
CREATE OR REPLACE FUNCTION public.verify_security_integrity()
RETURNS TABLE(
  check_name text,
  status text,
  details text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Verificar se todos os tokens estão criptografados
  RETURN QUERY
  SELECT 
    'token_encryption'::text,
    CASE 
      WHEN COUNT(*) = 0 THEN 'PASS'
      ELSE 'FAIL' 
    END::text,
    CASE 
      WHEN COUNT(*) = 0 THEN 'All tokens properly encrypted'
      ELSE FORMAT('%s tokens found without proper encryption', COUNT(*))
    END::text
  FROM google_drive_tokens 
  WHERE access_token_secret_id IS NULL 
     OR refresh_token_secret_id IS NULL;

  -- Verificar políticas RLS ativas
  RETURN QUERY
  SELECT 
    'rls_enabled'::text,
    CASE 
      WHEN COUNT(*) = 8 THEN 'PASS'  -- Esperamos 8 tabelas com RLS
      ELSE 'FAIL' 
    END::text,
    FORMAT('%s tables have RLS enabled', COUNT(*))::text
  FROM pg_tables t
  JOIN pg_class c ON c.relname = t.tablename
  WHERE t.schemaname = 'public' 
    AND c.relrowsecurity = true;

  -- Verificar logs de auditoria recentes
  RETURN QUERY
  SELECT 
    'audit_activity'::text,
    CASE 
      WHEN COUNT(*) > 0 THEN 'PASS'
      ELSE 'WARN' 
    END::text,
    FORMAT('%s audit entries in last 24h', COUNT(*))::text
  FROM google_drive_token_audit 
  WHERE timestamp > NOW() - INTERVAL '24 hours';
END;
$$;