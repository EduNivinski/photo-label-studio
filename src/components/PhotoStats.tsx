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
    // Por enquanto, consideramos todas como fotos
    // No futuro, podemos adicionar detecção por extensão ou tipo MIME
    const totalPhotos = photos.length;
    const totalVideos = 0; // Placeholder para futura implementação
    
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