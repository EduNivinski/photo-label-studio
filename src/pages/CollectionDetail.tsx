import { useState, useEffect } from 'react';
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
import type { Photo } from '@/types/photo';

export default function CollectionDetail() {
  const { id } = useParams<{ id: string }>();
  const { albums, updateAlbum, deleteAlbum, getAlbumPhotos } = useAlbums();
  const { photos, labels, updatePhotoLabels, deletePhoto } = useSupabaseData();
  const { toast } = useToast();
  
  const [showEditAlbum, setShowEditAlbum] = useState(false);
  const [collectionPhotos, setCollectionPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);

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

  // Load collection photos
  useEffect(() => {
    const loadCollectionPhotos = async () => {
      if (!id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const photos = await getAlbumPhotos(id);
        // Convert to Photo type format
        const formattedPhotos = photos.map(p => ({
          id: p.id,
          name: p.name,
          url: p.url,
          labels: p.labels,
          uploadDate: p.upload_date,
          originalDate: p.original_date,
          alias: p.alias,
          userId: '',
          mediaType: (p.media_type === 'video' ? 'video' : 'photo') as 'photo' | 'video'
        }));
        setCollectionPhotos(formattedPhotos);
      } catch (error) {
        console.error('Error loading collection photos:', error);
        setCollectionPhotos([]);
      } finally {
        setLoading(false);
      }
    };

    loadCollectionPhotos();
  }, [id, getAlbumPhotos]);

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

  const handleUpdateAlbum = async (albumId: string, updates: Partial<Pick<Album, 'name' | 'cover_photo_url'>>) => {
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
                  {loading ? 'Carregando...' : (() => {
                    const photos = collectionPhotos.filter(p => p.mediaType === 'photo').length;
                    const videos = collectionPhotos.filter(p => p.mediaType === 'video').length;
                    const parts = [];
                    if (photos > 0) parts.push(`${photos} foto${photos !== 1 ? 's' : ''}`);
                    if (videos > 0) parts.push(`${videos} vídeo${videos !== 1 ? 's' : ''}`);
                    return parts.length > 0 ? parts.join(' • ') : 'Vazio';
                  })()}
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
              <span className="text-sm text-muted-foreground">Coleção criada em:</span>
              <div className="text-xs text-muted-foreground">
                {new Date(collection.created_at).toLocaleDateString('pt-BR')}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Photos Grid */}
      <main className="flex-1">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4"></div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Carregando arquivos...
            </h3>
          </div>
        ) : collectionPhotos.length === 0 ? (
          <div className="p-12 text-center">
            <Archive className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Coleção vazia
            </h3>
            <p className="text-muted-foreground mb-4">
              Esta coleção ainda não possui nenhum arquivo.
            </p>
            <Link to="/">
              <Button>Voltar à Biblioteca</Button>
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
        open={showEditAlbum}
        onOpenChange={setShowEditAlbum}
        onUpdate={handleUpdateAlbum}
        album={collection}
      />
    </div>
  );
}