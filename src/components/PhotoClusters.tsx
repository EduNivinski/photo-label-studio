import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Label, Photo } from '@/types/photo';

interface PhotoClustersProps {
  photos: Photo[];
  labels: Label[];
  onClusterClick: (labelIds: string[]) => void;
}

interface Cluster {
  id: string;
  labelIds: string[];
  labelNames: string[];
  photoCount: number;
  thumbnail: string;
}

export function PhotoClusters({ photos, labels, onClusterClick }: PhotoClustersProps) {
  const clusters = useMemo(() => {
    // Criar mapa de combinações de labels mais frequentes
    const combinations = new Map<string, {
      labelIds: string[];
      photos: Photo[];
    }>();

    photos.forEach(photo => {
      if (photo.labels.length >= 2) {
        // Ordenar labels para garantir consistência na chave
        const sortedLabels = [...photo.labels].sort();
        const key = sortedLabels.join(',');
        
        if (!combinations.has(key)) {
          combinations.set(key, {
            labelIds: sortedLabels,
            photos: []
          });
        }
        combinations.get(key)!.photos.push(photo);
      }
    });

    // Converter para clusters e filtrar os mais relevantes
    const clustersList: Cluster[] = Array.from(combinations.entries())
      .filter(([_, data]) => data.photos.length >= 3) // Mínimo 3 fotos por cluster
      .map(([key, data]) => {
        const labelNames = data.labelIds
          .map(id => labels.find(l => l.id === id)?.name)
          .filter(Boolean) as string[];

        return {
          id: key,
          labelIds: data.labelIds,
          labelNames,
          photoCount: data.photos.length,
          thumbnail: data.photos[0].url // Primeira foto como thumbnail
        };
      })
      .sort((a, b) => b.photoCount - a.photoCount)
      .slice(0, 12); // Top 12 clusters

    return clustersList;
  }, [photos, labels]);

  if (clusters.length === 0) {
    return (
      <div className="px-6 py-8 text-center">
        <div className="text-4xl mb-4">📁</div>
        <h3 className="text-lg font-medium text-foreground mb-2">
          Nenhum cluster encontrado
        </h3>
        <p className="text-muted-foreground">
          Adicione mais labels às suas fotos para criar clusters automáticos
        </p>
      </div>
    );
  }

  return (
    <div className="px-6 py-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Clusters de Visualização
        </h2>
        <p className="text-sm text-muted-foreground">
          Grupos de fotos com labels relacionadas
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {clusters.map((cluster) => (
          <Card 
            key={cluster.id}
            className="cursor-pointer hover:shadow-md transition-shadow duration-200 group"
            onClick={() => onClusterClick(cluster.labelIds)}
          >
            <CardContent className="p-0">
              <div className="aspect-square relative overflow-hidden rounded-t-lg">
                <img
                  src={cluster.thumbnail}
                  alt="Cluster thumbnail"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
                <div className="absolute top-2 right-2">
                  <Badge variant="secondary" className="bg-black/70 text-white">
                    {cluster.photoCount}
                  </Badge>
                </div>
              </div>
              
              <div className="p-4">
                <div className="flex flex-wrap gap-1 mb-2">
                  {cluster.labelNames.slice(0, 3).map((name, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {name}
                    </Badge>
                  ))}
                  {cluster.labelNames.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{cluster.labelNames.length - 3}
                    </Badge>
                  )}
                </div>
                
                <p className="text-sm text-muted-foreground">
                  {cluster.photoCount} foto{cluster.photoCount !== 1 ? 's' : ''}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}