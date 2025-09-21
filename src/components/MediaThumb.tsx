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
  const [src, setSrc] = useState(item.posterUrl || null);
  const retried = useRef(false);

  useEffect(() => {
    setSrc(item.posterUrl || null);
    retried.current = false;
  }, [item.id, item.posterUrl]);

  const handleError = async () => {
    // For DB items, just use fallback
    if (item.source !== 'gdrive') {
      onError?.();
      return;
    }
    
    // For GDrive items, try to get fresh URL once
    if (retried.current) {
      onError?.();
      return;
    }
    
    retried.current = true;
    try {
      const fileId = item.id.split(':')[1];
      const { data } = await supabase.functions.invoke('get-thumb-urls', {
        body: { fileIds: [fileId] }
      });
      
      const fresh = data?.urls?.[fileId];
      if (fresh) {
        setSrc(fresh + '&cb=' + Date.now()); // cache-buster
      } else {
        onError?.();
      }
    } catch (error) {
      console.error('Failed to refresh thumb URL:', error);
      onError?.();
    }
  };

  return (
    <img
      src={src || '/img/placeholder.png'}
      alt={item.name}
      loading="lazy"
      onLoad={onLoad}
      onError={handleError}
      className={`h-full w-full object-cover ${className}`}
    />
  );
}