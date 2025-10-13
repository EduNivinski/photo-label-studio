-- Adicionar coluna mime_type na tabela photos para registrar o tipo exato do arquivo
ALTER TABLE public.photos
  ADD COLUMN IF NOT EXISTS mime_type text NULL;

-- Índice para facilitar queries por tipo de arquivo
CREATE INDEX IF NOT EXISTS idx_photos_mime_type ON public.photos(mime_type);

-- Atualizar registros existentes com valores padrão baseados em media_type
UPDATE public.photos
SET mime_type = CASE 
  WHEN media_type = 'video' THEN 'video/mp4'
  WHEN media_type = 'photo' THEN 'image/jpeg'
  ELSE 'application/octet-stream'
END
WHERE mime_type IS NULL;