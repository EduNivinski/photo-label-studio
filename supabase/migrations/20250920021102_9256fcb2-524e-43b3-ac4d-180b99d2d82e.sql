-- Create labels_items table for unified label support
CREATE TABLE IF NOT EXISTS public.labels_items (
  label_id UUID NOT NULL REFERENCES public.labels(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('db','gdrive')),
  item_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (label_id, source, item_key)
);

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS labels_items_source_key_idx ON public.labels_items (source, item_key);

-- Enable RLS
ALTER TABLE public.labels_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own label items" 
ON public.labels_items 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.labels 
    WHERE labels.id = labels_items.label_id 
    AND labels.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create their own label items" 
ON public.labels_items 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.labels 
    WHERE labels.id = labels_items.label_id 
    AND labels.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own label items" 
ON public.labels_items 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.labels 
    WHERE labels.id = labels_items.label_id 
    AND labels.user_id = auth.uid()
  )
);