-- CORREÇÃO URGENTE DE SEGURANÇA: Remover políticas perigosas

-- 1. CRITICAL: Remover política que expõe todos os logs de auditoria
DROP POLICY IF EXISTS "Security admins can view audit logs" ON public.google_drive_token_audit;

-- 2. CRITICAL: Remover política que permite inserção irrestrita de eventos de segurança
DROP POLICY IF EXISTS "System can insert security events" ON public.security_events;

-- 3. Criar política restritiva para eventos de segurança (apenas service_role)
CREATE POLICY "Service role only can insert security events" 
ON public.security_events 
FOR INSERT 
USING (false)
WITH CHECK (false);

-- 4. Conceder acesso apenas ao service_role para inserir eventos
GRANT INSERT ON public.security_events TO service_role;

-- 5. Criar política mais restritiva para auditoria (apenas próprios logs)
CREATE POLICY "Users can view only their own audit logs" 
ON public.google_drive_token_audit 
FOR SELECT 
USING (auth.uid() = user_id);

-- 6. Política para service_role acessar logs (para fins de administração)
CREATE POLICY "Service role can manage audit logs" 
ON public.google_drive_token_audit 
FOR ALL 
USING (current_user = 'service_role');

-- 7. Garantir que apenas service_role pode inserir logs de auditoria
GRANT ALL ON public.google_drive_token_audit TO service_role;