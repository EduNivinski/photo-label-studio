import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MediaItem, MediaListRequest, MediaListResponse } from '@/types/media';
import { extractSourceAndKey } from '@/lib/media-adapters';

export function useUnifiedMedia() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const loadItems = useCallback(async (request: MediaListRequest): Promise<MediaListResponse> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke('library-list-unified', {
        body: request
      });

      if (error) {
        throw new Error(error.message || 'Failed to load media items');
      }

      const response = data as MediaListResponse;
      setItems(response.items);
      setTotal(response.total);
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Error loading unified media:', err);
      return {
        items: [],
        total: 0,
        page: request.page,
        pageSize: request.pageSize
      };
    } finally {
      setLoading(false);
    }
  }, []);

  const addLabel = async (mediaId: string, labelId: string) => {
    try {
      const { source, key } = extractSourceAndKey(mediaId);
      
      const { error } = await supabase.functions.invoke('labels-assign', {
        body: {
          labelId,
          source,
          itemKey: key
        }
      });

      if (error) throw error;
    } catch (err) {
      console.error('Error adding label:', err);
      throw err;
    }
  };

  const removeLabel = async (mediaId: string, labelId: string) => {
    try {
      const { source, key } = extractSourceAndKey(mediaId);
      
      const { error } = await supabase.functions.invoke('labels-remove', {
        body: {
          labelId,
          source,
          itemKey: key
        }
      });

      if (error) throw error;
    } catch (err) {
      console.error('Error removing label:', err);
      throw err;
    }
  };

  return {
    items,
    loading,
    total,
    error,
    loadItems,
    addLabel,
    removeLabel
  };
}