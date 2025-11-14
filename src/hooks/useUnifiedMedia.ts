import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MediaItem, MediaListRequest, MediaListResponse } from '@/types/media';
import { extractSourceAndKey } from '@/lib/media-adapters';

export function useUnifiedMedia() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [totalPhotos, setTotalPhotos] = useState(0);
  const [totalVideos, setTotalVideos] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [needsDriveReauth, setNeedsDriveReauth] = useState(false);

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

      // Enrich items with labels from DB to ensure consistency across environments
      const baseItems = response.items as MediaItem[];

      // Collect item keys per source
      const sourceKeys = baseItems.reduce<Record<string, string[]>>((acc, item) => {
        const { source, key } = extractSourceAndKey(item.id);
        if (!acc[source]) acc[source] = [];
        acc[source].push(key);
        return acc;
      }, {});

      // Load labels dictionary (RLS will scope to current user)
      const { data: labelsData } = await supabase.from('labels').select('*');
      const labelsMap = new Map(labelsData?.map((l: any) => [l.id, l]) || []);

      // Load assignments for each present source
      const assignmentsByItem = new Map<string, string[]>();
      for (const [source, keys] of Object.entries(sourceKeys)) {
        if (keys.length === 0) continue;
        const { data: assigns } = await supabase
          .from('labels_items')
          .select('item_key,label_id')
          .eq('source', source)
          .in('item_key', keys);
        assigns?.forEach((a: any) => {
          const mapKey = `${source}:${a.item_key}`;
          if (!assignmentsByItem.has(mapKey)) assignmentsByItem.set(mapKey, []);
          assignmentsByItem.get(mapKey)!.push(a.label_id);
        });
      }

      // Build enriched items (merge labels from response with DB assignments)
      const enrichedItems: MediaItem[] = baseItems.map((item) => {
        const { source, key } = extractSourceAndKey(item.id);
        const mapKey = `${source}:${key}`;
        const assignedIds = assignmentsByItem.get(mapKey) || [];
        const assigned = assignedIds.map((id) => {
          const l = labelsMap.get(id);
          return { id, name: l?.name || id, color: l?.color };
        });
        // Merge with any labels already present from the edge response
        const existing = item.labels || [];
        const merged = [...existing, ...assigned].reduce<Record<string, { id: string; name: string; color?: string }>>((acc, l) => {
          acc[l.id] = l;
          return acc;
        }, {});
        return { ...item, labels: Object.values(merged) };
      });

      setItems(enrichedItems);
      setTotal(response.total);
      setTotalPhotos(response.totalPhotos || 0);
      setTotalVideos(response.totalVideos || 0);
      
      // Update needsDriveReauth state
      const reauth = (response as any).needsDriveReauth || false;
      setNeedsDriveReauth(reauth);
      
      console.log('📊 Loaded items:', enrichedItems.length, 'of', response.total);
      console.log('🏷️ Labels enriched for items:', enrichedItems.filter(i => i.labels?.length).length);
      console.log('🔒 Needs Drive reauth:', reauth);
      
      return { 
        ...response, 
        items: enrichedItems,
        needsDriveReauth: reauth
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('❌ Error loading unified media, falling back to local DB:', err);
      
      // Fallback: Load photos from local database directly
      try {
        // First verify we have an authenticated user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          console.error('❌ No authenticated user for fallback:', userError);
          throw new Error('Authentication required');
        }

        console.log('🔄 Using fallback with user:', user.id);

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

        // Get labels for the current user only (RLS will handle this automatically)
        const { data: labelsData } = await supabase
          .from('labels')
          .select('*');
        
        const labelsMap = new Map(labelsData?.map(label => [label.id, label]) || []);

        // Get label assignments from labels_items table for photos owned by this user
        // RLS policies will automatically filter to this user's data
        const { data: labelAssignments } = await supabase
          .from('labels_items')
          .select('item_key, label_id')
          .eq('source', 'db');

        // Create a map of photo ID to assigned labels
        const photoLabelsMap = new Map<string, string[]>();
        labelAssignments?.forEach(assignment => {
          const photoId = assignment.item_key;
          if (!photoLabelsMap.has(photoId)) {
            photoLabelsMap.set(photoId, []);
          }
          photoLabelsMap.get(photoId)!.push(assignment.label_id);
        });

        console.log(`📊 Fallback loaded: ${photos?.length || 0} photos, ${labelsData?.length || 0} labels for user ${user.id}`);

        // Transform to MediaItem format
        const mediaItems: MediaItem[] = (photos || []).map(photo => {
          const assignedLabelIds = photoLabelsMap.get(photo.id) || [];
          
          return {
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
            labels: assignedLabelIds.map(labelId => {
              const labelData = labelsMap.get(labelId);
              return {
                id: labelId,
                name: labelData?.name || labelId,
                color: labelData?.color
              };
            })
          };
        });

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
    totalPhotos,
    totalVideos,
    error,
    needsDriveReauth,
    loadItems,
    addLabel,
    removeLabel
  };
}