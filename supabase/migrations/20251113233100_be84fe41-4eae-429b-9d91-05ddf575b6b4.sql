-- Remove política que bloqueia tudo
DROP POLICY IF EXISTS "deny all sync" ON drive_sync_state;

-- Permite usuários autenticados lerem apenas seu próprio estado de sincronização
CREATE POLICY "Users can view their own sync state"
ON drive_sync_state
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Bloqueia INSERT do client-side (apenas edge functions com service role podem inserir)
CREATE POLICY "Users cannot insert sync state"
ON drive_sync_state
FOR INSERT
TO authenticated
WITH CHECK (false);

-- Bloqueia UPDATE do client-side (apenas edge functions com service role podem atualizar)
CREATE POLICY "Users cannot update sync state"
ON drive_sync_state
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

-- Bloqueia DELETE do client-side (apenas edge functions com service role podem deletar)
CREATE POLICY "Users cannot delete sync state"
ON drive_sync_state
FOR DELETE
TO authenticated
USING (false);