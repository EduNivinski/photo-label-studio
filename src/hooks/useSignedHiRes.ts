import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

type HiResEntry = { url: string; expiresAt: number };
const hiresCache = new Map<string, HiResEntry>();

export async function requestHiResUrl(fileId: string, size = 1024): Promise<string | null> {
  const cacheKey = `${fileId}:${size}`;
  const now = Date.now();
  
  // Check cache for unexpired URL
  const cached = hiresCache.get(cacheKey);
  if (cached && now < cached.expiresAt - 60_000) { // 1min buffer
    console.log(`💾 [HiRes Cache] Hit for ${fileId}`);
    return cached.url;
  }
  
  console.log(`🌐 [HiRes Cache] Miss for ${fileId}, fetching...`);
  
  // Fetch fresh URL
  try {
    const { data, error } = await supabase.functions.invoke('drive-thumb-fetch', {
      body: { itemId: fileId, size }
    });
    
    if (error) throw error;
    if (!data?.ok || !data?.url) throw new Error('No preview URL returned');
    
    // Cache with 50min expiry (signed URLs last ~1h)
    const expiresAt = Date.now() + 50 * 60 * 1000;
    hiresCache.set(cacheKey, { url: data.url, expiresAt });
    
    console.log(`✅ [HiRes Cache] Stored ${fileId}:${size}`);
    return data.url;
  } catch (error) {
    console.error(`❌ [HiRes Cache] Failed for ${fileId}:`, error);
    return null;
  }
}

export function useSignedHiRes() {
  const [loading, setLoading] = useState(false);

  const loadHiRes = useCallback(async (fileId: string, size = 1024): Promise<string | null> => {
    setLoading(true);
    try {
      return await requestHiResUrl(fileId, size);
    } finally {
      setLoading(false);
    }
  }, []);

  const invalidateHiRes = useCallback((fileId: string, size = 1024) => {
    const cacheKey = `${fileId}:${size}`;
    hiresCache.delete(cacheKey);
    console.log(`🗑️ [HiRes Cache] Invalidated ${cacheKey}`);
  }, []);

  return { loadHiRes, invalidateHiRes, loading };
}
