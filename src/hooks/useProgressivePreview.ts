import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MediaItem } from '@/types/media';
import { extractSourceAndKey } from '@/lib/media-adapters';

interface PreviewState {
  isLoading: boolean;
  url: string | null;
  error: string | null;
}

export const useProgressivePreview = () => {
  const [previews, setPreviews] = useState<Record<string, PreviewState>>({});
  const abortControllers = useRef<Record<string, AbortController>>({});

  const loadImagePreview = useCallback(async (item: MediaItem, maxSize = 1600) => {
    if (item.source !== 'gdrive') return item.posterUrl;
    
    const { key: fileId } = extractSourceAndKey(item.id);
    const cacheKey = `image_${fileId}_${maxSize}`;
    
    // Return existing preview if available
    if (previews[cacheKey]?.url) {
      return previews[cacheKey].url;
    }
    
    // Abort previous request for this item
    if (abortControllers.current[cacheKey]) {
      abortControllers.current[cacheKey].abort();
    }
    
    // Create new abort controller
    const controller = new AbortController();
    abortControllers.current[cacheKey] = controller;
    
    setPreviews(prev => ({
      ...prev,
      [cacheKey]: { isLoading: true, url: null, error: null }
    }));

    try {
      console.log(`🖼️ Loading image preview for ${item.name} (fileId: ${fileId}, max: ${maxSize})`);
      
      const { data, error } = await supabase.functions.invoke("drive-image-preview", {
        body: { fileId, max: maxSize }
      });

      if (controller.signal.aborted) return null;

      if (error) {
        throw new Error(error.message || 'Failed to load image preview');
      }

      // Convert blob to URL
      const blob = new Blob([data], { type: 'image/jpeg' });
      const url = URL.createObjectURL(blob);
      
      setPreviews(prev => ({
        ...prev,
        [cacheKey]: { isLoading: false, url, error: null }
      }));
      
      console.log(`✅ Image preview loaded for ${item.name}`);
      return url;
      
    } catch (err) {
      if (controller.signal.aborted) return null;
      
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error(`❌ Failed to load image preview for ${item.name}:`, errorMsg);
      
      setPreviews(prev => ({
        ...prev,
        [cacheKey]: { isLoading: false, url: null, error: errorMsg }
      }));
      
      // Fallback to thumbnail
      return item.posterUrl;
    } finally {
      delete abortControllers.current[cacheKey];
    }
  }, [previews]);

  const loadVideoPreview = useCallback(async (item: MediaItem, maxSize = 1280) => {
    if (item.source !== 'gdrive') return item.posterUrl;
    
    const { key: fileId } = extractSourceAndKey(item.id);
    const cacheKey = `video_${fileId}_${maxSize}`;
    
    // Return existing preview if available
    if (previews[cacheKey]?.url) {
      return previews[cacheKey].url;
    }
    
    // Abort previous request for this item
    if (abortControllers.current[cacheKey]) {
      abortControllers.current[cacheKey].abort();
    }
    
    // Create new abort controller
    const controller = new AbortController();
    abortControllers.current[cacheKey] = controller;
    
    setPreviews(prev => ({
      ...prev,
      [cacheKey]: { isLoading: true, url: null, error: null }
    }));

    try {
      console.log(`🎬 Loading video poster for ${item.name} (fileId: ${fileId}, max: ${maxSize})`);
      
      const { data, error } = await supabase.functions.invoke("drive-video-poster", {
        body: { fileId, max: maxSize }
      });

      if (controller.signal.aborted) return null;

      if (error) {
        throw new Error(error.message || 'Failed to load video poster');
      }

      // Convert blob to URL
      const blob = new Blob([data], { type: 'image/jpeg' });
      const url = URL.createObjectURL(blob);
      
      setPreviews(prev => ({
        ...prev,
        [cacheKey]: { isLoading: false, url, error: null }
      }));
      
      console.log(`✅ Video poster loaded for ${item.name}`);
      return url;
      
    } catch (err) {
      if (controller.signal.aborted) return null;
      
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error(`❌ Failed to load video poster for ${item.name}:`, errorMsg);
      
      setPreviews(prev => ({
        ...prev,
        [cacheKey]: { isLoading: false, url: null, error: errorMsg }
      }));
      
      // Fallback to thumbnail
      return item.posterUrl;
    } finally {
      delete abortControllers.current[cacheKey];
    }
  }, [previews]);

  const getPreviewState = useCallback((item: MediaItem, maxSize?: number, isVideo = false) => {
    if (item.source !== 'gdrive') return { isLoading: false, url: item.posterUrl, error: null };
    
    const { key: fileId } = extractSourceAndKey(item.id);
    const size = maxSize || (isVideo ? 1280 : 1600);
    const cacheKey = `${isVideo ? 'video' : 'image'}_${fileId}_${size}`;
    
    return previews[cacheKey] || { isLoading: false, url: null, error: null };
  }, [previews]);

  const cleanup = useCallback(() => {
    // Abort all pending requests
    Object.values(abortControllers.current).forEach(controller => {
      controller.abort();
    });
    abortControllers.current = {};
    
    // Revoke all blob URLs
    Object.values(previews).forEach(preview => {
      if (preview.url && preview.url.startsWith('blob:')) {
        URL.revokeObjectURL(preview.url);
      }
    });
    setPreviews({});
  }, [previews]);

  return {
    loadImagePreview,
    loadVideoPreview,
    getPreviewState,
    cleanup
  };
};