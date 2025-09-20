import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

type VideoEntry = { url: string; expiresAt: number };
const videoCache = new Map<string, VideoEntry>();

export async function requestVideoUrls(fileIds: string[]): Promise<Record<string, string>> {
  if (!fileIds?.length) return {};
  
  const needUrls: string[] = [];
  const now = Date.now();
  
  // Check cache for unexpired URLs
  for (const id of fileIds) {
    const cached = videoCache.get(id);
    if (!cached || now > cached.expiresAt - 30_000) {
      needUrls.push(id);
    }
  }
  
  // Fetch fresh URLs if needed
  if (needUrls.length > 0) {
    try {
      const { data, error } = await supabase.functions.invoke('get-video-urls', {
        body: { fileIds: needUrls }
      });
      
      if (error) throw error;
      
      const ttlSec = data?.ttlSec ?? 600;
      const expiresAt = Date.now() + ttlSec * 1000;
      
      // Cache new URLs
      for (const [id, url] of Object.entries<string>(data?.urls || {})) {
        videoCache.set(id, { url, expiresAt });
      }
    } catch (error) {
      console.error('Failed to fetch video URLs:', error);
    }
  }
  
  // Return URLs for all requested file IDs
  const result: Record<string, string> = {};
  for (const id of fileIds) {
    const cached = videoCache.get(id);
    if (cached) {
      result[id] = cached.url;
    }
  }
  
  return result;
}

export function useSignedVideos() {
  const [loading, setLoading] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});

  const loadVideos = useCallback(async (fileIds: string[]) => {
    if (!fileIds?.length) return;
    
    setLoading(true);
    try {
      const videoUrls = await requestVideoUrls(fileIds);
      setUrls(prev => ({ ...prev, ...videoUrls }));
    } catch (error) {
      console.error('Error loading video URLs:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const getVideoUrl = useCallback((fileId: string): string => {
    return urls[fileId] || videoCache.get(fileId)?.url || '';
  }, [urls]);

  const invalidateVideo = useCallback((fileId: string) => {
    videoCache.delete(fileId);
    setUrls(prev => {
      const newUrls = { ...prev };
      delete newUrls[fileId];
      return newUrls;
    });
  }, []);

  return {
    loadVideos,
    getVideoUrl,
    invalidateVideo,
    loading
  };
}