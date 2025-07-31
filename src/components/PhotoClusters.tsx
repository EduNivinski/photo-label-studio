import { useState, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlbumCard } from '@/components/AlbumCard';
import { CreateAlbumDialog } from '@/components/CreateAlbumDialog';
import { EditAlbumDialog } from '@/components/EditAlbumDialog';
import { useAlbums } from '@/hooks/useAlbums';
import type { Photo, Label } from '@/types/photo';
import type { Album } from '@/types/album';

interface PhotoClustersProps {
  photos: Photo[];
  labels: Label[];
  onClusterClick: (labelIds: string[]) => void;
  selectedLabels: string[];
  filteredPhotos: Photo[];
}

interface Cluster {
  id: string;
  labelIds: string[];
  labelNames: string[];
  photoCount: number;
  thumbnail: string;
}

export function PhotoClusters({ photos, labels, onClusterClick, selectedLabels, filteredPhotos }: PhotoClustersProps) {
  const { albums, createAlbum, updateAlbum, deleteAlbum } = useAlbums();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null);

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

  const handleCreateAlbum = async (name: string, labelIds: string[], coverPhotoUrl?: string) => {
    await createAlbum(name, labelIds, coverPhotoUrl);
  };

  const handleEditAlbum = (album: Album) => {
    setEditingAlbum(album);
    setIsEditDialogOpen(true);
  };

  const handleUpdateAlbum = async (id: string, updates: Partial<Pick<Album, 'name' | 'labels' | 'cover_photo_url'>>) => {
    await updateAlbum(id, updates);
    setIsEditDialogOpen(false);
    setEditingAlbum(null);
  };

  const handleDeleteAlbum = async (albumId: string) => {
    const confirmed = confirm('Tem certeza que deseja excluir este álbum?');
    if (confirmed) {
      await deleteAlbum(albumId);
    }
  };

  return (
    <div className="px-6 py-4">
      {/* Meus Álbuns */}
      {albums.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Meus Álbuns</h2>
            <Badge variant="secondary" className="text-xs">
              {albums.length} álbum{albums.length !== 1 ? 'ns' : ''}
            </Badge>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {albums.map(album => (
              <AlbumCard
                key={album.id}
                album={album}
                labels={labels}
                onClick={() => onClusterClick(album.labels)}
                onEdit={handleEditAlbum}
                onDelete={handleDeleteAlbum}
                isUserCreated={true}
              />
            ))}
          </div>
        </div>
      )}

      {/* Botão Criar Álbum */}
      {selectedLabels.length > 0 && (
        <div className="mb-6">
          <Button 
            onClick={() => setIsCreateDialogOpen(true)}
            className="w-full md:w-auto"
            variant="outline"
          >
            <Plus className="h-4 w-4 mr-2" />
            Criar Álbum com Labels Atuais
          </Button>
        </div>
      )}

      {/* Clusters Automáticos */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Clusters de Visualização</h2>
          <Badge variant="secondary" className="text-xs">
            {clusters.length} cluster{clusters.length !== 1 ? 's' : ''} encontrado{clusters.length !== 1 ? 's' : ''}
          </Badge>
        </div>

        {clusters.length === 0 ? (
          <div className="py-8 text-center">
            <div className="text-4xl mb-4">📁</div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              Nenhum cluster encontrado
            </h3>
            <p className="text-muted-foreground">
              Adicione mais labels às suas fotos para criar clusters automáticos
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {clusters.map((cluster) => (
              <Card 
                key={cluster.id}
                className="cursor-pointer hover:shadow-md transition-shadow duration-200 group"
                onClick={() => onClusterClick(cluster.labelIds)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1">
                        {cluster.labelNames.join(' + ')}
                      </h3>
                      <span className="text-xs text-muted-foreground">Cluster automático</span>
                    </div>
                  </div>

                  <div className="aspect-video bg-muted rounded-lg mb-3 overflow-hidden">
                    <img
                      src={cluster.thumbnail}
                      alt="Cluster thumbnail"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  
                  <p className="text-sm text-muted-foreground">
                    {cluster.photoCount} foto{cluster.photoCount !== 1 ? 's' : ''}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <CreateAlbumDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onCreateAlbum={handleCreateAlbum}
        selectedLabels={selectedLabels}
        labels={labels}
        filteredPhotos={filteredPhotos}
      />

      <EditAlbumDialog
        isOpen={isEditDialogOpen}
        onClose={() => {
          setIsEditDialogOpen(false);
          setEditingAlbum(null);
        }}
        onUpdateAlbum={handleUpdateAlbum}
        album={editingAlbum}
        labels={labels}
        photos={photos}
      />
    </div>
  );
}