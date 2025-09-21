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
    
    // Debug log for videos
    if (item.isVideo && item.source === 'gdrive') {
      console.log('🎬 Video MediaThumb:', {
        name: item.name,
        posterUrl: item.posterUrl,
        poster: poster,
        fileId: item.id.split(":")[1]
      });
    }
  }, [item.id, item.posterUrl]);

  const onPosterError = async () => {
    console.log('❌ Poster error for:', item.name, 'source:', item.source, 'isVideo:', item.isVideo);
    if (item.source !== "gdrive" || retried.current) return;
    retried.current = true;
    try {
      const fileId = item.id.split(":")[1];
      console.log('🔄 Retrying thumbnail for video:', fileId);
      const { data } = await supabase.functions.invoke("get-thumb-urls", { body:{ fileIds:[fileId] }});
      const fresh = data?.urls?.[fileId];
      if (fresh) {
        console.log('✅ Got fresh poster URL for video:', fileId);
        setPoster(fresh + "&cb=" + Date.now());
      }
    } catch (err) {
      console.error('❌ Failed to retry poster:', err);
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