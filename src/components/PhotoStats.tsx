import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import type { MediaItem } from '@/types/media';

interface PhotoStatsProps {
  items: MediaItem[];
  onCreateCollection?: () => void;
}

export function PhotoStats({ items, onCreateCollection }: PhotoStatsProps) {
  const stats = useMemo(() => {
    const totalPhotos = items.filter(item => !item.isVideo).length;
    const totalVideos = items.filter(item => item.isVideo).length;
    
    return {
      totalPhotos,
      totalVideos
    };
  }, [items]);

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