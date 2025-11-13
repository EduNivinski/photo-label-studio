-- Limpeza imediata: Marcar como deleted todos os drive_items que não pertencem ao root_folder_id atual
-- Esta migration identifica o root_folder_id atual de cada usuário e marca como deleted
-- todos os arquivos que não são descendentes dessa pasta raiz

DO $$
DECLARE
  user_record RECORD;
  current_root_id TEXT;
  descendant_folder_ids TEXT[];
BEGIN
  -- Para cada usuário que tem configuração de drive
  FOR user_record IN 
    SELECT DISTINCT user_id, drive_folder_id 
    FROM user_drive_settings 
    WHERE drive_folder_id IS NOT NULL
  LOOP
    current_root_id := user_record.drive_folder_id;
    
    -- Buscar todos os folder_ids descendentes do root atual
    SELECT ARRAY_AGG(DISTINCT folder_id)
    INTO descendant_folder_ids
    FROM drive_folders
    WHERE user_id = user_record.user_id
      AND (
        folder_id = current_root_id
        OR current_root_id = ANY(string_to_array(path_cached, '/'))
      );
    
    -- Marcar como deleted os arquivos que não pertencem à árvore atual
    UPDATE drive_items
    SET
      status = 'deleted',
      deleted_at = NOW(),
      updated_at = NOW()
    WHERE
      user_id = user_record.user_id
      AND status != 'deleted'
      AND (
        parent_id IS NULL
        OR NOT (parent_id = ANY(COALESCE(descendant_folder_ids, ARRAY[]::TEXT[])))
      );
      
    RAISE NOTICE 'Cleaned up old drive_items for user: %', user_record.user_id;
  END LOOP;
END $$;