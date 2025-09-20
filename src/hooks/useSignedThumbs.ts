import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type ThumbEntry = { url: string; expiresAt: number };

// Global in-memory cache for thumbnails
const thumbCache = new Map<string, ThumbEntry>();

export async function requestThumbs(fileIds: string[]): Promise<Record<string, string>> {
  const need: string[] = [];
  const now = Date.now();
  
  // Check which thumbnails need to be fetched or renewed
  for (const id of fileIds) {
    const cached = thumbCache.get(id);
    if (!cached || now > cached.expiresAt - 30_000) { // renew 30s before expiry
      need.push(id);
    }
  }
  
  // Fetch only needed thumbnails
  if (need.length > 0) {
    try {
      const { data, error } = await supabase.functions.invoke("get-thumb-urls", { 
        body: { fileIds: need }
      });
      
      if (error) throw error;
      
      const ttlSec = data?.ttlSec ?? 600;
      const expiresAt = Date.now() + ttlSec * 1000;
      
      // Cache the new URLs
      for (const [id, url] of Object.entries<string>(data.urls || {})) {
        thumbCache.set(id, { url, expiresAt });
      }
    } catch (error) {
      console.error("Failed to fetch thumbnail URLs:", error);
      // Don't throw - return what we can from cache
    }
  }
  
  // Return URLs for all requested IDs
  const out: Record<string, string> = {};
  for (const id of fileIds) {
    out[id] = thumbCache.get(id)?.url || "";
  }
  return out;
}

export function useSignedThumbs() {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const requestInFlight = useRef(false);
  
  const loadThumbs = useCallback(async (fileIds: string[]) => {
    if (!fileIds.length || requestInFlight.current) return;
    
    requestInFlight.current = true;
    setLoading(true);
    
    try {
      const newUrls = await requestThumbs(fileIds);
      setUrls(current => ({ ...current, ...newUrls }));
    } catch (error) {
      console.error("Error loading thumbnails:", error);
    } finally {
      setLoading(false);
      requestInFlight.current = false;
    }
  }, []);
  
  const invalidateThumb = useCallback((fileId: string) => {
    thumbCache.delete(fileId);
    setUrls(current => {
      const updated = { ...current };
      delete updated[fileId];
      return updated;
    });
  }, []);
  
  const getThumbUrl = useCallback((fileId: string): string => {
    return urls[fileId] || thumbCache.get(fileId)?.url || "";
  }, [urls]);
  
  return {
    loadThumbs,
    getThumbUrl,
    invalidateThumb,
    loading
  };
}