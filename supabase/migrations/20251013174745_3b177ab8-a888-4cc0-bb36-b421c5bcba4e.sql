-- Adicionar colunas para tipo de mídia e data original em drive_items
ALTER TABLE public.drive_items
  ADD COLUMN IF NOT EXISTS media_kind text CHECK (media_kind IN ('photo','video')) NULL,
  ADD COLUMN IF NOT EXISTS original_taken_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS original_tz_offset_min integer NULL;

-- Índices para melhorar performance de queries
CREATE INDEX IF NOT EXISTS idx_drive_items_taken_at ON public.drive_items(original_taken_at DESC);
CREATE INDEX IF NOT EXISTS idx_drive_items_kind ON public.drive_items(media_kind);

-- Comentários para documentação
COMMENT ON COLUMN public.drive_items.media_kind IS 'Tipo de mídia: photo ou video, deduzido do mimeType ou metadata';
COMMENT ON COLUMN public.drive_items.original_taken_at IS 'Data/hora original de captura (EXIF/metadata) em UTC';
COMMENT ON COLUMN public.drive_items.original_tz_offset_min IS 'Offset de fuso horário em minutos, se disponível';