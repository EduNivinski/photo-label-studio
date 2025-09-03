import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import type { Photo } from '@/types/photo';

interface PhotoStatsProps {
  photos: Photo[];
  onCreateCollection?: () => void;
}

export function PhotoStats({ photos, onCreateCollection }: PhotoStatsProps) {
  const stats = useMemo(() => {
    const totalPhotos = photos.filter(photo => photo.mediaType === 'photo').length;
    const totalVideos = photos.filter(photo => photo.mediaType === 'video').length;
    
    return {
      totalPhotos,
      totalVideos
    };
  }, [photos]);

  return (
    <div className="flex items-center gap-4">
      <span className="text-sm text-muted-foreground">
        {stats.totalPhotos.toLocaleString()} fotos • {stats.totalVideos} vídeos
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