import { useState, useEffect, useRef } from 'react';
import { MediaItem } from '@/types/media';
import { withCacheBuster } from '@/lib/cacheBuster';
import { fetchThumbUrl } from '@/lib/thumbs';

interface MediaThumbProps {
  item: MediaItem;
  className?: string;
  onLoad?: () => void;
  onError?: () => void;
}

export function MediaThumb({ item, className = "", onLoad, onError }: MediaThumbProps) {
  const [poster, setPoster] = useState(item.posterUrl || null);
  const [loading, setLoading] = useState(false);
  const retried = useRef(false);

  // Fetch thumbnail if not provided and item is from gdrive
  useEffect(() => {
    let cancelled = false;

    const loadThumb = async () => {
      if (item.posterUrl || item.source !== "gdrive" || loading) {
        setPoster(item.posterUrl || null);
        return;
      }

      setLoading(true);
      retried.current = false;

      try {
        const thumbUrl = await fetchThumbUrl(item.id, 256);
        if (!cancelled && thumbUrl) {
          setPoster(thumbUrl);
        }
      } catch (err) {
        console.error('Failed to load thumbnail:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadThumb();

    return () => {
      cancelled = true;
    };
  }, [item.id, item.posterUrl, item.source]);

  const onPosterError = async () => {
    if (item.source !== "gdrive" || retried.current || loading) return;
    retried.current = true;
    
    try {
      const thumbUrl = await fetchThumbUrl(item.id, 256);
      if (thumbUrl) {
        setPoster(withCacheBuster(thumbUrl));
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