import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type VideoEntry = { url: string; expiresAt: number };

// Global in-memory cache for video URLs
const videoCache = new Map<string, VideoEntry>();

export async function requestVideoUrls(fileIds: string[]): Promise<Record<string, string>> {
  const need: string[] = [];
  const now = Date.now();
  
  // Check which video URLs need to be fetched or renewed
  for (const id of fileIds) {
    const cached = videoCache.get(id);
    if (!cached || now > cached.expiresAt - 30_000) { // renew 30s before expiry
      need.push(id);
    }
  }
  
  // Fetch only needed video URLs
  if (need.length > 0) {
    try {
      const { data, error } = await supabase.functions.invoke("get-video-urls", { 
        body: { fileIds: need }
      });
      
      if (error) throw error;
      
      const ttlSec = data?.ttlSec ?? 600;
      const expiresAt = Date.now() + ttlSec * 1000;
      
      // Cache the new URLs
      for (const [id, url] of Object.entries<string>(data.urls || {})) {
        videoCache.set(id, { url, expiresAt });
      }
    } catch (error) {
      console.error("Failed to fetch video URLs:", error);
      // Don't throw - return what we can from cache
    }
  }
  
  // Return URLs for all requested IDs
  const out: Record<string, string> = {};
  for (const id of fileIds) {
    out[id] = videoCache.get(id)?.url || "";
  }
  return out;
}

export function useSignedVideos() {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const requestInFlight = useRef(false);
  
  const loadVideoUrls = useCallback(async (fileIds: string[]) => {
    if (!fileIds.length || requestInFlight.current) return;
    
    requestInFlight.current = true;
    setLoading(true);
    
    try {
      const newUrls = await requestVideoUrls(fileIds);
      setUrls(current => ({ ...current, ...newUrls }));
    } catch (error) {
      console.error("Error loading video URLs:", error);
    } finally {
      setLoading(false);
      requestInFlight.current = false;
    }
  }, []);
  
  const invalidateVideo = useCallback((fileId: string) => {
    videoCache.delete(fileId);
    setUrls(current => {
      const updated = { ...current };
      delete updated[fileId];
      return updated;
    });
  }, []);
  
  const getVideoUrl = useCallback((fileId: string): string => {
    return urls[fileId] || videoCache.get(fileId)?.url || "";
  }, [urls]);
  
  return {
    loadVideoUrls,
    getVideoUrl,
    invalidateVideo,
    loading
  };
}