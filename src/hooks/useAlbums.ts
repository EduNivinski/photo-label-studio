import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Album } from '@/types/album';

export function useAlbums() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlbums = async () => {
    try {
      const { data, error } = await supabase
        .from('collections')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAlbums(data || []);
    } catch (error) {
      console.error('Error fetching albums:', error);
      toast.error('Erro ao carregar coleções');
    } finally {
      setLoading(false);
    }
  };

  const createAlbum = async (name: string, photoIds: string[] = [], coverPhotoUrl?: string): Promise<Album | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data: album, error: albumError } = await supabase
        .from('collections')
        .insert({
          name,
          cover_photo_url: coverPhotoUrl,
          user_id: user.id,
        })
        .select()
        .single();

      if (albumError) throw albumError;

      // Add photos to the collection if any were provided
      if (photoIds.length > 0) {
        const collectionPhotos = photoIds.map(photoId => ({
          collection_id: album.id,
          photo_id: photoId
        }));

        const { error: relationError } = await supabase
          .from('collection_photos')
          .insert(collectionPhotos);

        if (relationError) {
          console.error('Error adding photos to collection:', relationError);
        }
      }

      setAlbums(prev => [album, ...prev]);
      toast.success('Coleção criada com sucesso!');
      return album;
    } catch (error) {
      console.error('Error creating album:', error);
      toast.error('Erro ao criar coleção');
      return null;
    }
  };

  const updateAlbum = async (id: string, updates: Partial<Pick<Album, 'name' | 'cover_photo_url'>>): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('collections')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      setAlbums(prev => prev.map(album => 
        album.id === id ? { ...album, ...updates } : album
      ));
      toast.success('Álbum atualizado com sucesso!');
      return true;
    } catch (error) {
      console.error('Error updating album:', error);
      toast.error('Erro ao atualizar álbum');
      return false;
    }
  };

  const deleteAlbum = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('collections')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setAlbums(prev => prev.filter(album => album.id !== id));
      toast.success('Álbum excluído com sucesso!');
      return true;
    } catch (error) {
      console.error('Error deleting album:', error);
      toast.error('Erro ao excluir álbum');
      return false;
    }
  };

  useEffect(() => {
    fetchAlbums();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('collections_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'collections'
      }, () => {
        fetchAlbums();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const addPhotosToAlbum = async (albumId: string, photoIds: string[]): Promise<boolean> => {
    try {
      const collectionPhotos = photoIds.map(photoId => ({
        collection_id: albumId,
        photo_id: photoId
      }));

      const { error } = await supabase
        .from('collection_photos')
        .insert(collectionPhotos);

      if (error) throw error;
      toast.success('Fotos adicionadas à coleção!');
      return true;
    } catch (error) {
      console.error('Error adding photos to album:', error);
      toast.error('Erro ao adicionar fotos à coleção');
      return false;
    }
  };

  const removePhotosFromAlbum = async (albumId: string, photoIds: string[]): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('collection_photos')
        .delete()
        .eq('collection_id', albumId)
        .in('photo_id', photoIds);

      if (error) throw error;
      toast.success('Fotos removidas da coleção!');
      return true;
    } catch (error) {
      console.error('Error removing photos from album:', error);
      toast.error('Erro ao remover fotos da coleção');
      return false;
    }
  };

  const getAlbumPhotos = async (albumId: string) => {
    try {
      const { data, error } = await supabase
        .from('collection_photos')
        .select(`
          photo_id,
          photos!inner (
            id,
            name,
            url,
            labels,
            upload_date,
            original_date,
            alias,
            media_type
          )
        `)
        .eq('collection_id', albumId);

      if (error) throw error;
      return data?.map(item => item.photos) || [];
    } catch (error) {
      console.error('Error fetching album photos:', error);
      return [];
    }
  };

  return {
    albums,
    loading,
    createAlbum,
    updateAlbum,
    deleteAlbum,
    addPhotosToAlbum,
    removePhotosFromAlbum,
    getAlbumPhotos,
    refetch: fetchAlbums
  };
}