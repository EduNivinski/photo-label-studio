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
    console.log('🔄 Loading unified media with request:', request);
    setLoading(true);
    setError(null);

    try {
      console.log('📡 Calling library-list-unified edge function...');
      const { data, error } = await supabase.functions.invoke('library-list-unified', {
        body: request
      });

      if (error) {
        console.error('❌ Edge function error:', error);
        throw new Error(error.message || 'Failed to load media items');
      }

      console.log('✅ Edge function response:', data);
      const response = data as MediaListResponse;
      setItems(response.items);
      setTotal(response.total);
      console.log('📊 Loaded items:', response.items.length, 'of', response.total);
      console.log('🖼️ Google Drive items with posterUrl:', response.items.filter(i => i.source === 'gdrive' && i.posterUrl).length);
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('❌ Error loading unified media, falling back to local DB:', err);
      
      // Fallback: Load photos from local database directly
      try {
        let query = supabase
          .from('photos')
          .select('*')
          .order('upload_date', { ascending: false });

        // Apply mime type filter
        if (request.mimeClass === "image") {
          query = query.eq('media_type', 'photo');
        } else if (request.mimeClass === "video") {
          query = query.eq('media_type', 'video');
        }

        const { data: photos, error: photoError } = await query;
        
        if (photoError) throw photoError;

        // Get all labels for proper display
        const { data: labelsData } = await supabase
          .from('labels')
          .select('*');
        
        const labelsMap = new Map(labelsData?.map(label => [label.id, label]) || []);

        // Transform to MediaItem format
        const mediaItems: MediaItem[] = (photos || []).map(photo => ({
          id: `db:${photo.id}`,
          source: 'db' as const,
          name: photo.name,
          mimeType: photo.media_type === 'video' ? 'video/mp4' : 'image/jpeg',
          isVideo: photo.media_type === 'video',
          width: null,
          height: null,
          durationMs: null,
          createdAt: photo.upload_date,
          updatedAt: photo.upload_date,
          posterUrl: photo.url,
          previewUrl: photo.url,
          openInDriveUrl: null,
          downloadEnabled: true,
          labels: photo.labels?.map((labelId: string) => {
            const labelData = labelsMap.get(labelId);
            return {
              id: labelId,
              name: labelData?.name || labelId,
              color: labelData?.color || null
            };
          }) || []
        }));

        setItems(mediaItems);
        setTotal(mediaItems.length);
        return {
          items: mediaItems,
          total: mediaItems.length,
          page: request.page,
          pageSize: request.pageSize
        };
      } catch (fallbackErr) {
        console.error('Fallback also failed:', fallbackErr);
        return {
          items: [],
          total: 0,
          page: request.page,
          pageSize: request.pageSize
        };
      }
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
      console.error('Error adding label via edge function, trying fallback:', err);
      
      // Fallback: Direct database operations for DB photos
      const { source, key } = extractSourceAndKey(mediaId);
      if (source === 'db') {
        try {
          // First check if the label assignment already exists
          const { data: existingLabel } = await supabase
            .from('labels_items')
            .select('*')
            .eq('label_id', labelId)
            .eq('source', source)
            .eq('item_key', key)
            .single();

          if (!existingLabel) {
            // Insert the label assignment
            const { error: insertError } = await supabase
              .from('labels_items')
              .insert({
                label_id: labelId,
                source: source,
                item_key: key
              });

            if (insertError) throw insertError;
          }

          // Also update the photos table for backwards compatibility
          const { data: photo } = await supabase
            .from('photos')
            .select('labels')
            .eq('id', key)
            .single();

          if (photo && !photo.labels?.includes(labelId)) {
            const updatedLabels = [...(photo.labels || []), labelId];
            await supabase
              .from('photos')
              .update({ labels: updatedLabels })
              .eq('id', key);
          }
        } catch (fallbackError) {
          console.error('Fallback addLabel also failed:', fallbackError);
          throw fallbackError;
        }
      } else {
        throw err; // Re-throw for non-DB sources
      }
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
      console.error('Error removing label via edge function, trying fallback:', err);
      
      // Fallback: Direct database operations for DB photos  
      const { source, key } = extractSourceAndKey(mediaId);
      if (source === 'db') {
        try {
          // Remove from labels_items table
          await supabase
            .from('labels_items')
            .delete()
            .eq('label_id', labelId)
            .eq('source', source)
            .eq('item_key', key);

          // Also update the photos table for backwards compatibility
          const { data: photo } = await supabase
            .from('photos')
            .select('labels')
            .eq('id', key)
            .single();

          if (photo && photo.labels?.includes(labelId)) {
            const updatedLabels = photo.labels.filter((id: string) => id !== labelId);
            await supabase
              .from('photos')
              .update({ labels: updatedLabels })
              .eq('id', key);
          }
        } catch (fallbackError) {
          console.error('Fallback removeLabel also failed:', fallbackError);
          throw fallbackError;
        }
      } else {
        throw err; // Re-throw for non-DB sources
      }
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