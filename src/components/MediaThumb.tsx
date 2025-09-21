import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MediaItem } from '@/types/media';

interface MediaThumbProps {
  item: MediaItem;
  className?: string;
  onLoad?: () => void;
  onError?: () => void;
}

export function MediaThumb({ item, className = "", onLoad, onError }: MediaThumbProps) {
  const [poster, setPoster] = useState(item.posterUrl || null);
  const retried = useRef(false);

  useEffect(() => { 
    setPoster(item.posterUrl || null); 
    retried.current = false; 
  }, [item.id, item.posterUrl]);

  const onPosterError = async () => {
    if (item.source !== "gdrive" || retried.current) return;
    retried.current = true;
    try {
      const fileId = item.id.split(":")[1];
      const { data } = await supabase.functions.invoke("get-thumb-urls", { body:{ fileIds:[fileId] }});
      const fresh = data?.urls?.[fileId];
      if (fresh) setPoster(fresh + "&cb=" + Date.now());
    } catch {}
  };

  return item.isVideo ? (
    <video
      className={`h-full w-full object-cover ${className}`}
      poster={poster || "/img/placeholder.png"}
      preload="metadata"
      playsInline
      muted
      onError={onPosterError}
      onLoadedMetadata={onLoad}
    />
  ) : (
    <img
      className={`h-full w-full object-cover ${className}`}
      src={poster || "/img/placeholder.png"}
      alt={item.name}
      loading="lazy"
      onError={onPosterError}
      onLoad={onLoad}
    />
  );
}