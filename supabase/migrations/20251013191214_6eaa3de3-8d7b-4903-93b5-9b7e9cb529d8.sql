-- Ajustar drive_sync_state para suportar BFS reentrante
ALTER TABLE public.drive_sync_state 
  ADD COLUMN IF NOT EXISTS root_folder_id text,
  ADD COLUMN IF NOT EXISTS pending_folders jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'idle' CHECK (status IN ('idle','running','error')),
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS stats jsonb DEFAULT '{}'::jsonb;

-- Garantir campos em drive_items
ALTER TABLE public.drive_items
  ADD COLUMN IF NOT EXISTS parent_id text,
  ADD COLUMN IF NOT EXISTS size_bigint bigint;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_drive_items_parent_id ON public.drive_items(parent_id);
CREATE INDEX IF NOT EXISTS idx_drive_sync_state_status ON public.drive_sync_state(status) WHERE status = 'running';