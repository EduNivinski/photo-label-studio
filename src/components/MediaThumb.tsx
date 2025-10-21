import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MediaItem } from '@/types/media';
import { withCacheBuster } from '@/lib/cacheBuster';

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
      // Use new drive-thumb-fetch endpoint
      const { data, error } = await supabase.functions.invoke("drive-thumb-fetch", { 
        body: { itemId: fileId, size: 256 }
      });
      if (!error && data?.ok && data?.url) {
        setPoster(withCacheBuster(data.url));
      }
    } catch (err) {
      console.error('Failed to retry thumbnail:', err);
    }
  };

  // For now, use img for both videos and images since we're only showing thumbnails
  // The video element with poster can be problematic in some browsers when there's no src
  return (
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