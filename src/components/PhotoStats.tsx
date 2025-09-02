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
    <div className="px-6 py-4 bg-card border-b border-border">
      <div className="flex gap-6 items-center">
        <Card className="flex-1">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="text-2xl">📸</div>
            <div>
              <p className="text-sm text-muted-foreground">Total de Fotos</p>
              <p className="text-2xl font-bold text-foreground">
                {stats.totalPhotos.toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="flex-1">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="text-2xl">🎥</div>
            <div>
              <p className="text-sm text-muted-foreground">Total de Vídeos</p>
              <p className="text-2xl font-bold text-foreground">
                {stats.totalVideos.toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>

        {onCreateCollection && (
          <Button
            onClick={onCreateCollection}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <Plus size={16} />
            Criar Coleção
          </Button>
        )}
      </div>
    </div>
  );
}