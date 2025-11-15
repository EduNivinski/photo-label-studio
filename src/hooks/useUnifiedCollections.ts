import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Album } from '@/types/album';

export type UnifiedCollection = {
  id: string;              // collection_id OU "drive:folder_name" OU "orphans"
  name: string;            // Nome da collection ou pasta
  type: 'manual' | 'drive' | 'orphans'; // Tipo para diferenciar
  count: number;           // Quantidade de items
  icon: 'folder' | 'cloud' | 'trash'; // Ícone visual
}

export function useUnifiedCollections() {
  const [collections, setCollections] = useState<UnifiedCollection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCollections();
    
    // 🔄 Setup real-time listeners
    const setupListeners = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let debounceTimer: NodeJS.Timeout;
      const debouncedReload = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          console.log('[collections] Reloading due to data change');
          loadCollections();
        }, 2000);
      };

      const channel = supabase
        .channel('collections-updates')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'drive_items',
          filter: `user_id=eq.${user.id}`
        }, debouncedReload)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'photos',
          filter: `user_id=eq.${user.id}`
        }, debouncedReload)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'drive_sync_state',
          filter: `user_id=eq.${user.id}`
        }, (payload) => {
          if (payload.new && 'status' in payload.new && payload.new.status === 'idle') {
            console.log('[collections] Sync complete, reloading');
            loadCollections();
          }
        })
        .subscribe();

      return () => {
        clearTimeout(debounceTimer);
        supabase.removeChannel(channel);
      };
    };

    const cleanup = setupListeners();
    return () => {
      cleanup.then(fn => fn?.());
    };
  }, []);

  const loadCollections = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setCollections([]);
        return;
      }

      // 1. Buscar collections manuais da tabela collections
      const { data: manualCollections } = await supabase
        .from('collections')
        .select('id, name')
        .eq('user_id', user.id);

      // 2. Buscar valores únicos de drive_origin_folder
      const { data: drivePhotos } = await supabase
        .from('photos')
        .select('drive_origin_folder')
        .eq('user_id', user.id)
        .not('drive_origin_folder', 'is', null);

      const { data: driveItems } = await supabase
        .from('drive_items')
        .select('drive_origin_folder')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .eq('trashed', false)
        .not('drive_origin_folder', 'is', null);

      // Combinar e deduplicate folders do Drive
      const driveFolders = new Set<string>();
      drivePhotos?.forEach(p => {
        if (p.drive_origin_folder) driveFolders.add(p.drive_origin_folder);
      });
      driveItems?.forEach(p => {
        if (p.drive_origin_folder) driveFolders.add(p.drive_origin_folder);
      });

      // 3. Contar items de cada collection manual
      const manualWithCount: UnifiedCollection[] = await Promise.all(
        (manualCollections || []).map(async (col) => {
          const { count: photosCount } = await supabase
            .from('photos')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .contains('collections', [col.id]);

          const { count: driveCount } = await supabase
            .from('drive_items')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('status', 'active')
            .eq('trashed', false)
            .contains('collections', [col.id]);

          return {
            id: col.id,
            name: col.name,
            type: 'manual' as const,
            count: (photosCount || 0) + (driveCount || 0),
            icon: 'folder' as const
          };
        })
      );

      // 4. Contar items de cada pasta do Drive
      const driveWithCount: UnifiedCollection[] = await Promise.all(
        Array.from(driveFolders).map(async (folder) => {
          const { count: photosCount } = await supabase
            .from('photos')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('drive_origin_folder', folder);

          const { count: driveCount } = await supabase
            .from('drive_items')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('status', 'active')
            .eq('trashed', false)
            .eq('drive_origin_folder', folder);

          return {
            id: `drive:${folder}`,
            name: folder,
            type: 'drive' as const,
            count: (photosCount || 0) + (driveCount || 0),
            icon: 'cloud' as const
          };
        })
      );

      // 5. Buscar órfãos (arquivos com origin_status='missing')
      const { count: orphanCount } = await supabase
        .from('drive_items')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('origin_status', 'missing')
        .eq('trashed', false);

      // Combinar e ordenar: manuais primeiro, depois Drive, depois Órfãos (se houver)
      const unified = [
        ...manualWithCount.sort((a, b) => a.name.localeCompare(b.name)),
        ...driveWithCount.sort((a, b) => a.name.localeCompare(b.name)),
        ...(orphanCount && orphanCount > 0 ? [{
          id: 'orphans',
          name: '🗑️ Arquivos Órfãos',
          type: 'orphans' as const,
          count: orphanCount,
          icon: 'trash' as const
        }] : [])
      ];

      setCollections(unified);
    } catch (error) {
      console.error('Error loading unified collections:', error);
      setCollections([]);
    } finally {
      setLoading(false);
    }
  };

  return {
    collections,
    loading,
    reload: loadCollections
  };
}
