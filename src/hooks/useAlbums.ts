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

  const createAlbum = async (name: string, labels: string[], coverPhotoUrl?: string): Promise<Album | null> => {
    try {
      const { data, error } = await supabase
        .from('collections')
        .insert({
          name,
          labels,
          cover_photo_url: coverPhotoUrl
        })
        .select()
        .single();

      if (error) throw error;
      
      setAlbums(prev => [data, ...prev]);
      toast.success('Coleção criada com sucesso!');
      return data;
    } catch (error) {
      console.error('Error creating album:', error);
      toast.error('Erro ao criar coleção');
      return null;
    }
  };

  const updateAlbum = async (id: string, updates: Partial<Pick<Album, 'name' | 'labels' | 'cover_photo_url'>>): Promise<boolean> => {
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

  return {
    albums,
    loading,
    createAlbum,
    updateAlbum,
    deleteAlbum,
    refetch: fetchAlbums
  };
}