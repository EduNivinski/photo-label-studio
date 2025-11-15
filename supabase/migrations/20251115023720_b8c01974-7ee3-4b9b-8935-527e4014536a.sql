-- FASE 1: Sistema de Lixeira Virtual - Schema
-- Adicionar colunas de controle de órfãos em drive_items
ALTER TABLE drive_items
ADD COLUMN IF NOT EXISTS origin_status TEXT DEFAULT 'active' 
  CHECK (origin_status IN ('active', 'missing', 'permanently_deleted')),
ADD COLUMN IF NOT EXISTS origin_missing_since TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS origin_missing_notified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_sync_seen TIMESTAMP WITH TIME ZONE;

-- Índices para performance em queries de lixeira
CREATE INDEX IF NOT EXISTS idx_drive_items_origin_status 
  ON drive_items(user_id, origin_status, origin_missing_since);

CREATE INDEX IF NOT EXISTS idx_drive_items_last_sync_seen 
  ON drive_items(user_id, last_sync_seen);

-- Comentários para documentação
COMMENT ON COLUMN drive_items.origin_status IS 
  'Status da origem: active (existe no Drive), missing (não encontrado na última sync), permanently_deleted (usuário confirmou deleção)';
COMMENT ON COLUMN drive_items.origin_missing_since IS 
  'Data em que o arquivo foi detectado como ausente no Drive';
COMMENT ON COLUMN drive_items.last_sync_seen IS 
  'Última vez que o arquivo foi visto durante uma sincronização completa';

-- Criar tabela de notificações de órfãos
CREATE TABLE IF NOT EXISTS drive_orphan_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  items_count INTEGER NOT NULL,
  sync_id TEXT NOT NULL,
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMP WITH TIME ZONE
);

-- Índice para buscar notificações pendentes
CREATE INDEX IF NOT EXISTS idx_orphan_notifications_user_acknowledged 
  ON drive_orphan_notifications(user_id, acknowledged);

-- RLS policies para notificações
ALTER TABLE drive_orphan_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own orphan notifications"
  ON drive_orphan_notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own orphan notifications"
  ON drive_orphan_notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Adicionar configuração de auto-deleção em user_drive_settings
ALTER TABLE user_drive_settings
ADD COLUMN IF NOT EXISTS auto_delete_orphans_days INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS auto_delete_enabled BOOLEAN DEFAULT true;

COMMENT ON COLUMN user_drive_settings.auto_delete_orphans_days IS 
  'Número de dias até auto-deletar arquivos órfãos (padrão: 30)';
COMMENT ON COLUMN user_drive_settings.auto_delete_enabled IS 
  'Se true, arquivos órfãos são automaticamente deletados após X dias';