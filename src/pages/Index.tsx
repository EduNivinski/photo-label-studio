import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSupabaseData } from '@/hooks/useSupabaseData';
import { usePhotoFilters } from '@/hooks/usePhotoFilters';
import { usePhotoSelection } from '@/hooks/usePhotoSelection';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useAlbums } from '@/hooks/useAlbums';
import { SearchBar } from '@/components/SearchBar';
import { MyAlbumsSection } from '@/components/MyAlbumsSection';
import { UnlabeledPhotosSection } from '@/components/UnlabeledPhotosSection';
import { SmartSuggestionsSection } from '@/components/SmartSuggestionsSection';
import { PhotoGallery } from '@/components/PhotoGallery';
import { SelectionPanel } from '@/components/SelectionPanel';
import { BulkLabelDialog } from '@/components/BulkLabelDialog';
import { UploadDialog } from '@/components/UploadDialog';
import { LabelManager } from '@/components/LabelManager';
import { PhotoModal } from '@/components/PhotoModal';
import { KeyboardShortcuts } from '@/components/KeyboardShortcuts';
import { LabelSuggestions } from '@/components/LabelSuggestions';
import { CreateAlbumDialog } from '@/components/CreateAlbumDialog';
import { EditAlbumDialog } from '@/components/EditAlbumDialog';
import type { Photo } from '@/types/photo';
import type { Album } from '@/types/album';

const Index = () => {
  const {
    photos,
    labels,
    loading,
    createLabel,
    deleteLabel,
    updatePhotoLabels,
    updatePhotoAlias,
    deletePhoto,
    uploadPhotos,
    applyLabelsToPhotos,
    getSuggestedLabels,
    applyLabelSuggestions
  } = useSupabaseData();

  const {
    albums,
    loading: albumsLoading,
    createAlbum,
    updateAlbum,
    deleteAlbum
  } = useAlbums();

  const {
    filters,
    filteredPhotos,
    updateSearchTerm,
    toggleLabel,
    toggleUnlabeled,
    clearFilters
  } = usePhotoFilters(photos);

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

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isLabelManagerOpen, setIsLabelManagerOpen] = useState(false);
  const [isBulkLabelDialogOpen, setIsBulkLabelDialogOpen] = useState(false);
  const [isLabelSuggestionsOpen, setIsLabelSuggestionsOpen] = useState(false);
  const [isCreateAlbumOpen, setIsCreateAlbumOpen] = useState(false);
  const [isEditAlbumOpen, setIsEditAlbumOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [labelSuggestions, setLabelSuggestions] = useState<{
    suggestions: string[];
    source: 'ai' | 'mock';
    photo: Photo | null;
  }>({ suggestions: [], source: 'mock', photo: null });
  
  // Estado para controlar qual view mostrar
  const [currentView, setCurrentView] = useState<'home' | 'gallery'>('home');

  // New event handlers for reorganized interface
  const handleViewUnlabeledPhotos = () => {
    toggleUnlabeled();
    setCurrentView('gallery');
  };

  const handleCreateAlbum = async () => {
    setIsCreateAlbumOpen(true);
  };

  const handleEditAlbum = (album: Album) => {
    setSelectedAlbum(album);
    setIsEditAlbumOpen(true);
  };

  const handleDeleteAlbum = async (albumId: string) => {
    const confirmed = confirm('Tem certeza que deseja deletar este álbum?');
    if (confirmed) {
      const success = await deleteAlbum(albumId);
      if (success) {
        toast.success('Álbum deletado com sucesso!');
      } else {
        toast.error('Erro ao deletar álbum');
      }
    }
  };

  const handleAlbumClick = (album: Album) => {
    // Apply album filters (labels associated with the album)
    album.labels.forEach(labelId => {
      if (!filters.labels.includes(labelId)) {
        toggleLabel(labelId);
      }
    });
    setCurrentView('gallery');
  };

  // Event handlers
  const handlePhotoClick = (photo: Photo) => {
    if (selectedCount > 0) {
      // If there are selected photos, treat click as selection toggle
      toggleSelection(photo.id, false, filteredPhotos);
    } else {
      // Normal behavior: open modal
      setSelectedPhoto(photo);
      setIsModalOpen(true);
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedPhoto(null);
  };

  const handleSelectionToggle = (photoId: string, isShiftPressed: boolean) => {
    toggleSelection(photoId, isShiftPressed, filteredPhotos);
  };

  const handleBulkLabelManage = () => {
    setIsBulkLabelDialogOpen(true);
  };

  const handleSelectAll = () => {
    selectAll(filteredPhotos);
  };

  const handleBulkDelete = async () => {
    const selectedPhotos = getSelectedPhotos(photos);
    if (selectedPhotos.length === 0) return;

    const confirmed = confirm(`Tem certeza que deseja deletar ${selectedPhotos.length} foto${selectedPhotos.length !== 1 ? 's' : ''}?`);
    if (!confirmed) return;

    let successCount = 0;
    for (const photo of selectedPhotos) {
      const success = await deletePhoto(photo.id);
      if (success) successCount++;
    }

    clearSelection();
    
    if (successCount === selectedPhotos.length) {
      toast.success(`${successCount} foto${successCount !== 1 ? 's' : ''} deletada${successCount !== 1 ? 's' : ''} com sucesso!`);
    } else {
      toast.error(`Erro ao deletar algumas fotos. ${successCount} de ${selectedPhotos.length} foram deletadas.`);
    }
  };

  const handleBulkApplyLabels = async (photoIds: string[], labelIds: string[]) => {
    let successCount = 0;
    for (const photoId of photoIds) {
      const photo = photos.find(p => p.id === photoId);
      if (photo) {
        const currentLabels = photo.labels;
        const newLabels = Array.from(new Set([...currentLabels, ...labelIds]));
        const success = await updatePhotoLabels(photoId, newLabels);
        if (success) successCount++;
      }
    }
    
    if (successCount === photoIds.length) {
      toast.success(`Labels aplicadas em ${successCount} foto${successCount !== 1 ? 's' : ''}!`);
    } else {
      toast.error(`Erro ao aplicar labels em algumas fotos. ${successCount} de ${photoIds.length} foram atualizadas.`);
    }
  };

  const handleBulkRemoveLabels = async (photoIds: string[], labelIds: string[]) => {
    let successCount = 0;
    for (const photoId of photoIds) {
      const photo = photos.find(p => p.id === photoId);
      if (photo) {
        const currentLabels = photo.labels;
        const newLabels = currentLabels.filter(id => !labelIds.includes(id));
        const success = await updatePhotoLabels(photoId, newLabels);
        if (success) successCount++;
      }
    }
    
    if (successCount === photoIds.length) {
      toast.success(`Labels removidas de ${successCount} foto${successCount !== 1 ? 's' : ''}!`);
    } else {
      toast.error(`Erro ao remover labels de algumas fotos. ${successCount} de ${photoIds.length} foram atualizadas.`);
    }
  };

  const handleUpload = () => {
    setIsUploadOpen(true);
  };

  const handleUploadFiles = async (files: File[]) => {
    const uploadedPhotos = await uploadPhotos(files);
    
    // Get suggestions for the first uploaded photo
    if (uploadedPhotos && uploadedPhotos.length > 0) {
      const firstPhoto = uploadedPhotos[0];
      try {
        const suggestions = await getSuggestedLabels(firstPhoto.url);
        setLabelSuggestions({
          suggestions: suggestions.suggestions,
          source: suggestions.source,
          photo: firstPhoto
        });
        setIsLabelSuggestionsOpen(true);
      } catch (error) {
        console.error('Error getting label suggestions:', error);
      }
    }
  };

  const handleLabelManage = (photo?: Photo) => {
    if (photo) {
      setSelectedPhoto(photo);
    }
    setIsLabelManagerOpen(true);
  };

  const handleClusterClick = (labelIds: string[]) => {
    // Aplicar filtros das labels do cluster
    labelIds.forEach(labelId => {
      if (!filters.labels.includes(labelId)) {
        toggleLabel(labelId);
      }
    });
    setCurrentView('gallery');
  };

  const handleBackToHome = () => {
    clearFilters();
    setCurrentView('home');
  };

  // Detectar quando filtros estão ativos
  const hasActiveFilters = filters.labels.length > 0 || filters.showUnlabeled || filters.searchTerm.trim() !== '';

  const handlePhotoDelete = async () => {
    if (!selectedPhoto) return;
    
    const success = await deletePhoto(selectedPhoto.id);
    if (success) {
      toast.success("Foto excluída com sucesso!");
      handleModalClose();
    } else {
      toast.error("Erro ao excluir foto");
    }
  };

  // Setup keyboard shortcuts
  useKeyboardShortcuts({
    onSelectAll: handleSelectAll,
    onDeleteSelected: handleBulkDelete,
    onManageLabels: handleBulkLabelManage,
    onClearSelection: clearSelection,
    hasSelectedPhotos: selectedCount > 0
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <h3 className="text-lg font-medium text-foreground mb-2">
            Carregando PhotoLabel...
          </h3>
          <p className="text-muted-foreground">
            Conectando ao banco de dados
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">PhotoLabel</h1>
              <p className="text-sm text-muted-foreground">
                Organize suas fotos com labels inteligentes
              </p>
            </div>
            
            {/* Upload Button - only show in home view */}
            {currentView === 'home' && !hasActiveFilters && (
              <div className="text-right">
                <Button 
                  onClick={handleUpload}
                  size="lg"
                  className="gap-2 px-6 shadow-lg hover:shadow-xl transition-all"
                >
                  <Upload className="h-5 w-5" />
                  Upload
                </Button>
                <p className="text-xs text-muted-foreground mt-1">
                  Adicione novas fotos e vídeos facilmente
                </p>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      {currentView === 'home' && !hasActiveFilters ? (
        <div className="flex-1 overflow-y-auto">
          {/* My Albums Section */}
          <MyAlbumsSection
            albums={albums}
            labels={labels}
            onCreateAlbum={handleCreateAlbum}
            onEditAlbum={handleEditAlbum}
            onDeleteAlbum={handleDeleteAlbum}
            onAlbumClick={handleAlbumClick}
          />

          {/* Unlabeled Photos Section */}
          <UnlabeledPhotosSection
            photos={photos}
            onViewAll={handleViewUnlabeledPhotos}
          />

          {/* Smart Suggestions Section */}
          <SmartSuggestionsSection
            photos={photos}
            labels={labels}
            onClusterClick={handleClusterClick}
          />
        </div>
      ) : (
        <>
          {/* Search Bar when in gallery mode */}
          {(currentView === 'gallery' || hasActiveFilters) && (
            <SearchBar
              searchTerm={filters.searchTerm}
              onSearchChange={updateSearchTerm}
              onUpload={handleUpload}
              labels={labels}
              selectedLabels={filters.labels}
              showUnlabeled={filters.showUnlabeled}
              onLabelToggle={toggleLabel}
              onToggleUnlabeled={toggleUnlabeled}
              onClearFilters={handleBackToHome}
              onManageLabels={() => handleLabelManage()}
            />
          )}

          {/* Photo Gallery */}
          <PhotoGallery
            photos={filteredPhotos}
            labels={labels}
            selectedPhotoIds={selectedPhotoIds}
            onPhotoClick={handlePhotoClick}
            onLabelManage={handleLabelManage}
            onSelectionToggle={handleSelectionToggle}
            onUpdateLabels={updatePhotoLabels}
          />
        </>
      )}

      {/* Selection Panel */}
      <SelectionPanel
        selectedCount={selectedCount}
        onManageLabels={handleBulkLabelManage}
        onDeleteSelected={handleBulkDelete}
        onClearSelection={clearSelection}
      />

      {/* Upload Dialog */}
      <UploadDialog
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUpload={uploadPhotos}
        labels={labels}
        onCreateLabel={createLabel}
        onApplyLabelsToPhotos={applyLabelsToPhotos}
      />

      {/* Label Manager */}
      <LabelManager
        isOpen={isLabelManagerOpen}
        onClose={() => {
          setIsLabelManagerOpen(false);
          setSelectedPhoto(null);
        }}
        labels={labels}
        selectedPhoto={selectedPhoto}
        onCreateLabel={createLabel}
        onDeleteLabel={deleteLabel}
        onUpdatePhotoLabels={updatePhotoLabels}
      />

      {/* Bulk Label Dialog */}
      <BulkLabelDialog
        isOpen={isBulkLabelDialogOpen}
        onClose={() => setIsBulkLabelDialogOpen(false)}
        selectedPhotos={getSelectedPhotos(photos)}
        labels={labels}
        onApplyLabels={handleBulkApplyLabels}
        onRemoveLabels={handleBulkRemoveLabels}
        onCreateLabel={createLabel}
      />

      {/* Photo Modal */}
      {selectedPhoto && (
        <PhotoModal
          photo={selectedPhoto}
          labels={labels}
          isOpen={isModalOpen}
          onClose={handleModalClose}
          onLabelManage={() => handleLabelManage(selectedPhoto)}
          onDelete={handlePhotoDelete}
          onUpdateAlias={updatePhotoAlias}
        />
      )}

      {/* Create Album Dialog */}
      <CreateAlbumDialog
        isOpen={isCreateAlbumOpen}
        onClose={() => setIsCreateAlbumOpen(false)}
        labels={labels}
        selectedLabels={filters.labels}
        filteredPhotos={filteredPhotos}
        onCreateAlbum={async (name, labels, coverPhotoUrl) => {
          const album = await createAlbum(name, labels, coverPhotoUrl);
          if (album) {
            toast.success('Álbum criado com sucesso!');
            setIsCreateAlbumOpen(false);
          } else {
            toast.error('Erro ao criar álbum');
          }
        }}
      />

      {/* Edit Album Dialog */}
      {selectedAlbum && (
        <EditAlbumDialog
          isOpen={isEditAlbumOpen}
          onClose={() => {
            setIsEditAlbumOpen(false);
            setSelectedAlbum(null);
          }}
          album={selectedAlbum}
          labels={labels}
          photos={photos}
          onUpdateAlbum={async (id, updates) => {
            const success = await updateAlbum(id, updates);
            if (success) {
              toast.success('Álbum atualizado com sucesso!');
              setIsEditAlbumOpen(false);
              setSelectedAlbum(null);
            } else {
              toast.error('Erro ao atualizar álbum');
            }
          }}
        />
      )}

      {/* Label Suggestions Dialog */}
      {labelSuggestions.photo && (
        <LabelSuggestions
          isOpen={isLabelSuggestionsOpen}
          onClose={() => {
            setIsLabelSuggestionsOpen(false);
            setLabelSuggestions({ suggestions: [], source: 'mock', photo: null });
          }}
          photo={labelSuggestions.photo}
          suggestions={labelSuggestions.suggestions}
          source={labelSuggestions.source}
          existingLabels={labels}
          onApplyLabels={applyLabelSuggestions}
        />
      )}

      {/* Keyboard Shortcuts Tooltip */}
      <KeyboardShortcuts />
    </div>
  );
};

export default Index;