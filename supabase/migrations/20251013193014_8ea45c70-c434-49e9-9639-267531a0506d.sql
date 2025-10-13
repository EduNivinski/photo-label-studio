-- Garantir índice único para onConflict em drive_items
CREATE UNIQUE INDEX IF NOT EXISTS uq_drive_items_user_file 
  ON public.drive_items(user_id, file_id);

-- Garantir GRANT para security.can_call (idempotente)
DO $$
BEGIN
  GRANT EXECUTE ON FUNCTION security.can_call(uuid, text, text, integer, integer) TO service_role;
EXCEPTION WHEN undefined_function THEN
  -- Função ainda não existe, ignorar
  NULL;
END $$;