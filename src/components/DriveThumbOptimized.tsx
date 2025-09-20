import { useEffect, useState, useCallback } from "react";
import { useSignedThumbs } from "@/hooks/useSignedThumbs";

interface DriveThumbOptimizedProps {
  fileId: string;
  name: string;
  className?: string;
  onLoad?: () => void;
}

export function DriveThumbOptimized({ fileId, name, className, onLoad }: DriveThumbOptimizedProps) {
  const { loadThumbs, getThumbUrl, invalidateThumb } = useSignedThumbs();
  const [url, setUrl] = useState<string>("");
  const [attempts, setAttempts] = useState(0);
  const [loading, setLoading] = useState(true);

  // Load thumbnail URL on mount
  useEffect(() => {
    let aborted = false;
    
    const fetchUrl = async () => {
      // Check if we already have this URL cached
      const cachedUrl = getThumbUrl(fileId);
      if (cachedUrl) {
        if (!aborted) {
          setUrl(cachedUrl);
          setLoading(false);
        }
        return;
      }
      
      // Load new thumbnail
      await loadThumbs([fileId]);
      if (!aborted) {
        const newUrl = getThumbUrl(fileId);
        setUrl(newUrl);
        setLoading(false);
      }
    };

    fetchUrl();
    
    return () => {
      aborted = true;
    };
  }, [fileId, loadThumbs, getThumbUrl]);

  const handleError = useCallback(async () => {
    if (attempts >= 1) return; // maximum 1 retry
    
    setAttempts(prev => prev + 1);
    
    // Invalidate cache for this fileId and retry
    invalidateThumb(fileId);
    await loadThumbs([fileId]);
    const newUrl = getThumbUrl(fileId);
    setUrl(newUrl);
  }, [attempts, fileId, invalidateThumb, loadThumbs, getThumbUrl]);

  if (loading || !url) {
    return (
      <div 
        className={className || "h-32 w-32 bg-muted animate-pulse rounded-md"} 
        aria-label="Loading thumbnail"
      />
    );
  }

  return (
    <img
      src={url}
      alt={name}
      loading="lazy"
      onError={handleError}
      onLoad={onLoad}
      className={className || "h-32 w-32 object-cover rounded-md bg-muted"}
    />
  );
}