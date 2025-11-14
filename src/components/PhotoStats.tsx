import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import type { MediaItem } from '@/types/media';

interface PhotoStatsProps {
  items: MediaItem[];
  totalItems: MediaItem[];
  onCreateCollection?: () => void;
}

export function PhotoStats({ items, totalItems, onCreateCollection }: PhotoStatsProps) {
  const stats = useMemo(() => {
    // Função auxiliar para validar se é foto/vídeo válido
    const isValidMedia = (item: MediaItem) => {
      // Deve ter mimeType definido e começar com image/ ou video/
      if (!item.mimeType) return false;
      return item.mimeType.startsWith('image/') || item.mimeType.startsWith('video/');
    };

    // Filtrados (exibidos)
    const displayedPhotos = items.filter(item => 
      isValidMedia(item) && !item.isVideo
    ).length;
    
    const displayedVideos = items.filter(item => 
      isValidMedia(item) && item.isVideo
    ).length;
    
    // Totais (sem filtros)
    const totalPhotos = totalItems.filter(item => 
      isValidMedia(item) && !item.isVideo
    ).length;
    
    const totalVideos = totalItems.filter(item => 
      isValidMedia(item) && item.isVideo
    ).length;
    
    return {
      displayedPhotos,
      displayedVideos,
      totalPhotos,
      totalVideos
    };
  }, [items, totalItems]);

  return (
    <div className="flex items-center gap-4">
      <span className="text-sm text-muted-foreground">
        {stats.displayedPhotos.toLocaleString()} de {stats.totalPhotos.toLocaleString()} fotos • {stats.displayedVideos} de {stats.totalVideos} vídeos
      </span>
      
      {onCreateCollection && (
        <Button
          onClick={onCreateCollection}
          variant="create"
          size="sm"
          className="flex items-center gap-2"
        >
          <Plus size={16} />
          Criar Coleção
        </Button>
      )}
    </div>
  );
}