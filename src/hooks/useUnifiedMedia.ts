import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MediaItem, MediaListRequest, MediaListResponse } from '@/types/media';

export function useUnifiedMedia() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const loadItems = async (request: MediaListRequest): Promise<MediaListResponse> => {
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
  };

  const addLabel = async (mediaId: string, labelId: string) => {
    try {
      const [source, itemKey] = mediaId.split(':', 2);
      
      const { error } = await supabase
        .from('labels_items')
        .insert({
          label_id: labelId,
          source: source as 'db' | 'gdrive',
          item_key: itemKey
        });

      if (error) throw error;
    } catch (err) {
      console.error('Error adding label:', err);
      throw err;
    }
  };

  const removeLabel = async (mediaId: string, labelId: string) => {
    try {
      const [source, itemKey] = mediaId.split(':', 2);
      
      const { error } = await supabase
        .from('labels_items')
        .delete()
        .eq('label_id', labelId)
        .eq('source', source)
        .eq('item_key', itemKey);

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