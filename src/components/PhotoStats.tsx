import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import type { MediaItem } from '@/types/media';

interface PhotoStatsProps {
  items: MediaItem[];
  totalPhotos: number;
  totalVideos: number;
  onCreateCollection?: () => void;
}

export function PhotoStats({ 
  items, 
  totalPhotos, 
  totalVideos, 
  onCreateCollection 
}: PhotoStatsProps) {
  
  const { displayedPhotos, displayedVideos } = useMemo(() => {
    return items.reduce((acc, item) => {
      const isValid = item.mimeType && 
        (item.mimeType.startsWith('image/') || item.mimeType.startsWith('video/'));
      
      if (!isValid) return acc;
      
      if (item.isVideo) {
        acc.displayedVideos++;
      } else {
        acc.displayedPhotos++;
      }
      return acc;
    }, { displayedPhotos: 0, displayedVideos: 0 });
  }, [items]);

  // SEMPRE mostrar ambos contadores, mesmo se zero
  const photosText = `${displayedPhotos} ${displayedPhotos === 1 ? 'foto' : 'fotos'} de ${totalPhotos.toLocaleString()} ${totalPhotos === 1 ? 'foto' : 'fotos'}`;
  const videosText = `${displayedVideos} ${displayedVideos === 1 ? 'vídeo' : 'vídeos'} de ${totalVideos.toLocaleString()} ${totalVideos === 1 ? 'vídeo' : 'vídeos'}`;

  return (
    <div className="flex items-center gap-4">
      <span className="text-sm text-muted-foreground">
        {photosText} • {videosText}
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