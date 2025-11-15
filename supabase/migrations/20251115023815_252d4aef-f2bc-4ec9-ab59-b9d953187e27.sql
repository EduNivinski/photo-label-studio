-- Adicionar policy de INSERT para service_role na tabela drive_orphan_notifications
CREATE POLICY "Service role can insert orphan notifications"
  ON drive_orphan_notifications FOR INSERT
  WITH CHECK (true);