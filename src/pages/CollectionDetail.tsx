import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PhotoGallery } from '@/components/PhotoGallery';
import { SelectionPanel } from '@/components/SelectionPanel';
import { useAlbums } from '@/hooks/useAlbums';
import { useSupabaseData } from '@/hooks/useSupabaseData';
import { usePhotoSelection } from '@/hooks/usePhotoSelection';
import { useToast } from '@/hooks/use-toast';
import { EditAlbumDialog } from '@/components/EditAlbumDialog';
import type { Album } from '@/types/album';

export default function CollectionDetail() {
  const { id } = useParams<{ id: string }>();
  const { albums, updateAlbum, deleteAlbum } = useAlbums();
  const { photos, labels, updatePhotoLabels, deletePhoto } = useSupabaseData();
  const { toast } = useToast();
  
  const [showEditAlbum, setShowEditAlbum] = useState(false);

  // Photo selection state
  const {
    selectedPhotoIds,
    selectedCount,
    isSelected,
    toggleSelection,
    selectAll,
    clearSelection,
    getSelectedPhotos
  } = usePhotoSelection();

  // Find the collection
  const collection = albums.find(album => album.id === id);

  // Get photos that match the collection's labels
  const collectionPhotos = useMemo(() => {
    if (!collection || collection.labels.length === 0) return [];
    
    return photos.filter(photo => 
      collection.labels.every(labelId => photo.labels.includes(labelId))
    );
  }, [photos, collection]);

  if (!collection) {
    return (
      <div className="flex-1 min-h-screen bg-background flex items-center justify-center">
        <Card className="p-12 text-center">
          <Archive className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Coleção não encontrada
          </h2>
          <p className="text-muted-foreground mb-4">
            A coleção que você está procurando não existe ou foi removida.
          </p>
          <Link to="/collections">
            <Button>Voltar às Coleções</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const handleUpdateAlbum = async (albumId: string, updates: Partial<Pick<Album, 'name' | 'labels' | 'cover_photo_url'>>) => {
    const success = await updateAlbum(albumId, updates);
    if (success) {
      toast({
        title: "Coleção atualizada com sucesso!",
        description: "As alterações foram salvas.",
      });
      setShowEditAlbum(false);
    } else {
      toast({
        title: "Erro ao atualizar coleção",
        description: "Ocorreu um erro ao salvar as alterações.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteCollection = async () => {
    const confirmed = confirm(`Tem certeza que deseja deletar a coleção "${collection.name}"?`);
    if (!confirmed) return;

    const success = await deleteAlbum(collection.id);
    if (success) {
      toast({
        title: "Coleção deletada com sucesso!",
        description: `A coleção "${collection.name}" foi removida.`,
      });
      // Navigate back to collections page
      window.location.href = '/collections';
    } else {
      toast({
        title: "Erro ao deletar coleção",
        description: "Ocorreu um erro ao deletar a coleção.",
        variant: "destructive",
      });
    }
  };

  const handlePhotoClick = (photo: any) => {
    // Handle single photo view if needed
  };

  const handleLabelManage = (photo: any) => {
    // Handle label management for individual photo
  };

  const handleSelectionToggle = (photoId: string, isShiftPressed: boolean) => {
    toggleSelection(photoId, isShiftPressed, collectionPhotos);
  };

  const handleUpdateLabels = (photoId: string, labelIds: string[]) => {
    updatePhotoLabels(photoId, labelIds);
  };

  const handleDeleteSelected = async () => {
    const selectedPhotos = getSelectedPhotos(collectionPhotos);
    if (selectedPhotos.length === 0) return;

    if (confirm(`Tem certeza que deseja deletar ${selectedPhotos.length} foto(s)?`)) {
      for (const photo of selectedPhotos) {
        await deletePhoto(photo.id);
      }
      clearSelection();
      toast({
        title: "Fotos deletadas",
        description: `${selectedPhotos.length} foto(s) foram deletadas com sucesso.`,
      });
    }
  };

  return (
    <div className="flex-1 min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/collections">
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Voltar
                </Button>
              </Link>
              
              <div>
                <h1 className="text-2xl font-bold text-foreground">{collection.name}</h1>
                <p className="text-sm text-muted-foreground">
                  {collectionPhotos.length} foto{collectionPhotos.length !== 1 ? 's' : ''} • {collection.labels.length} label{collection.labels.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowEditAlbum(true)}
                className="gap-2"
              >
                <Edit className="h-4 w-4" />
                Editar
              </Button>
              
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={handleDeleteCollection}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Deletar
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Collection Info */}
      <section className="border-b border-border bg-card/30">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">Labels da coleção:</span>
              <div className="flex flex-wrap gap-2">
                {collection.labels.map(labelId => {
                  const label = labels.find(l => l.id === labelId);
                  if (!label) return null;
                  
                  return (
                    <Badge 
                      key={labelId} 
                      variant="secondary"
                      style={{
                        backgroundColor: label.color ? `${label.color}20` : undefined,
                        borderColor: label.color || undefined,
                        color: label.color || undefined,
                      }}
                    >
                      {label.name}
                    </Badge>
                  );
                })}
              </div>
            </div>
            
            <div className="text-xs text-muted-foreground">
              Criada em {new Date(collection.created_at).toLocaleDateString('pt-BR')}
            </div>
          </div>
        </div>
      </section>

      {/* Photos Grid */}
      <main className="flex-1">
        {collectionPhotos.length === 0 ? (
          <div className="p-12 text-center">
            <Archive className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Nenhuma foto encontrada
            </h3>
            <p className="text-muted-foreground mb-4">
              Esta coleção não possui fotos que correspondam às labels selecionadas.
            </p>
            <Link to="/explore">
              <Button>Explorar Biblioteca</Button>
            </Link>
          </div>
        ) : (
          <PhotoGallery
            photos={collectionPhotos}
            labels={labels}
            selectedPhotoIds={selectedPhotoIds}
            onPhotoClick={handlePhotoClick}
            onLabelManage={handleLabelManage}
            onSelectionToggle={handleSelectionToggle}
            onUpdateLabels={handleUpdateLabels}
          />
        )}
      </main>

      {/* Selection Panel */}
      <SelectionPanel
        selectedCount={selectedCount}
        onManageLabels={() => {/* TODO: implement bulk label management */}}
        onDeleteSelected={handleDeleteSelected}
        onClearSelection={clearSelection}
        onCreateCollection={() => {/* Already in a collection */}}
      />

      {/* Edit Dialog */}
      <EditAlbumDialog
        isOpen={showEditAlbum}
        onClose={() => setShowEditAlbum(false)}
        onUpdateAlbum={handleUpdateAlbum}
        album={collection}
        labels={labels}
        photos={photos}
      />
    </div>
  );
}