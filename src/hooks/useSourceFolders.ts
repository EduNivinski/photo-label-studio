import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useSourceFolders() {
  const [folders, setFolders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const loadSourceFolders = async () => {
    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch unique drive_origin_folder values from both tables
      const [driveItemsResult, photosResult] = await Promise.all([
        supabase
          .from('drive_items')
          .select('drive_origin_folder')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .not('drive_origin_folder', 'is', null),
        supabase
          .from('photos')
          .select('drive_origin_folder')
          .eq('user_id', user.id)
          .not('drive_origin_folder', 'is', null)
      ]);

      const driveFolders = driveItemsResult.data?.map(item => item.drive_origin_folder).filter(Boolean) || [];
      const photoFolders = photosResult.data?.map(item => item.drive_origin_folder).filter(Boolean) || [];

      // Combine and deduplicate
      const uniqueFolders = Array.from(new Set([...driveFolders, ...photoFolders] as string[])).sort();
      
      setFolders(uniqueFolders);
    } catch (error: any) {
      console.error('Error loading source folders:', error);
      toast.error('Erro ao carregar pastas de origem');
    } finally {
      setLoading(false);
    }
  };

  const convertFolderToCollection = async (sourceFolder: string, collectionName: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Você precisa estar autenticado');
        return;
      }

      const response = await supabase.functions.invoke('collections-convert-bulk', {
        body: { sourceFolder, collectionName },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        console.error('Error converting folder:', response.error);
        toast.error('Erro ao converter pasta em collection');
        return;
      }

      const result = response.data;
      if (result.ok) {
        toast.success(`${result.converted} ${result.converted === 1 ? 'item convertido' : 'itens convertidos'} para collection "${collectionName}"`);
      } else {
        toast.error('Erro ao converter pasta em collection');
      }
    } catch (error: any) {
      console.error('Error converting folder:', error);
      toast.error('Erro ao converter pasta em collection');
    }
  };

  useEffect(() => {
    loadSourceFolders();
  }, []);

  return {
    folders,
    loading,
    loadSourceFolders,
    convertFolderToCollection,
  };
}