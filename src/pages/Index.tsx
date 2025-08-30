import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Upload, Library, FolderOpen, FolderPlus, Edit, Trash2, Grid3X3, List } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AppSidebar } from '@/components/AppSidebar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Toggle } from '@/components/ui/toggle';
import { useSupabaseData } from '@/hooks/useSupabaseData';
import { usePhotoFilters } from '@/hooks/usePhotoFilters';
import { usePhotoSelection } from '@/hooks/usePhotoSelection';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useAlbums } from '@/hooks/useAlbums';
import { usePagination } from '@/hooks/usePagination';
import { SearchBar } from '@/components/SearchBar';
import { RelatedLabelsBar } from '@/components/RelatedLabelsBar';
import { PhotoGallery } from '@/components/PhotoGallery';
import { PhotoStats } from '@/components/PhotoStats';
import { SelectionPanel } from '@/components/SelectionPanel';
import { BulkLabelDialog } from '@/components/BulkLabelDialog';
import { UploadDialog } from '@/components/UploadDialog';
import { LabelManager } from '@/components/LabelManager';
import { PhotoModal } from '@/components/PhotoModal';
import { KeyboardShortcuts } from '@/components/KeyboardShortcuts';
import { LabelSuggestions } from '@/components/LabelSuggestions';
import { CreateAlbumDialog } from '@/components/CreateAlbumDialog';
import { EditAlbumDialog } from '@/components/EditAlbumDialog';
import { DateFilters } from '@/components/DateFilters';
import { AdvancedFilters } from '@/components/AdvancedFilters';
import { HomeFiltersBar } from '@/components/HomeFiltersBar';
import type { Photo } from '@/types/photo';
import type { Album } from '@/types/album';

const Index = () => {
  console.log('Index component rendered - no currentView references');
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
    updateFilters,
    toggleLabel,
    toggleUnlabeled,
    clearFilters,
    includedLabels,
    excludedLabels,
    includeLabel,
    excludeLabel,
    removeLabel,
    getRelatedLabels,
    showFavorites,
    toggleFavorites
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
  
  // Estados para UI
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [itemsPerPage, setItemsPerPage] = useState(30);
  
  // Pagination
  const {
    paginatedItems: paginatedPhotos,
    hasMoreItems,
    loadMore,
    reset: resetPagination,
    changeItemsPerPage,
    totalItems,
    currentlyShowing
  } = usePagination(filteredPhotos, itemsPerPage);

  // Update pagination when filters change
  useEffect(() => {
    resetPagination();
  }, [filteredPhotos, resetPagination]);

  const handleCreateCollection = () => {
    setIsCreateAlbumOpen(true);
  };

  const handleEditCollection = (album: Album) => {
    setSelectedAlbum(album);
    setIsEditAlbumOpen(true);
  };

  const handleDeleteCollection = async (albumId: string) => {
    try {
      await deleteAlbum(albumId);
      toast.success('Álbum excluído com sucesso!');
    } catch (error) {
      console.error('Erro ao excluir álbum:', error);
      toast.error('Erro ao excluir álbum');
    }
  };

  const handleItemsPerPageChange = (newItemsPerPage: string) => {
    const numItems = parseInt(newItemsPerPage);
    setItemsPerPage(numItems);
    changeItemsPerPage(numItems);
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

  // Detectar quando filtros estão ativos
  const hasActiveFilters = filters.labels.length > 0 || filters.showUnlabeled || filters.searchTerm.trim() !== '' || 
    includedLabels.length > 0 || excludedLabels.length > 0 || showFavorites;

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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
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
    <div className="flex-1 min-h-screen bg-background">
      {/* Hero Section - Simplified */}
      <section className="px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">📷 PhotoLabel</h1>
          <Button 
            onClick={handleUpload}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            Upload
          </Button>
        </div>
      </section>

      {/* Search Bar - Always visible */}
      <SearchBar
        searchTerm={filters.searchTerm}
        onSearchChange={updateSearchTerm}
        onUpload={handleUpload}
        labels={labels}
        selectedLabels={filters.labels}
        showUnlabeled={filters.showUnlabeled}
        onLabelToggle={toggleLabel}
        onToggleUnlabeled={toggleUnlabeled}
        onClearFilters={clearFilters}
        onManageLabels={() => handleLabelManage()}
        onIncludeLabel={includeLabel}
        includedLabels={includedLabels}
        excludedLabels={excludedLabels}
      />

      {/* Related Labels Bar - Sales Navigator style */}
      <RelatedLabelsBar
        relatedLabels={getRelatedLabels}
        allLabels={labels}
        includedLabels={includedLabels}
        excludedLabels={excludedLabels}
        onIncludeLabel={includeLabel}
        onExcludeLabel={excludeLabel}
        onRemoveLabel={removeLabel}
      />

      {/* Home Filters Bar - Date, Favorites, Sort */}
      <div className="px-6 py-3">
        <HomeFiltersBar
          filters={filters}
          showFavorites={showFavorites}
          onUpdateFilters={updateFilters}
          onToggleFavorites={toggleFavorites}
        />
      </div>

      {/* Photo Stats */}
      <PhotoStats photos={filteredPhotos} />

      {/* Pagination Controls */}
      <div className="px-6 py-3 bg-card border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Mostrando {currentlyShowing} de {totalItems} fotos
            </span>
            
            <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 por página</SelectItem>
                <SelectItem value="60">60 por página</SelectItem>
                <SelectItem value="100">100 por página</SelectItem>
                <SelectItem value="200">200 por página</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-2">
            <Toggle
              pressed={viewMode === 'grid'}
              onPressedChange={() => setViewMode('grid')}
              aria-label="Grid view"
            >
              <Grid3X3 className="h-4 w-4" />
            </Toggle>
            <Toggle
              pressed={viewMode === 'list'}
              onPressedChange={() => setViewMode('list')}
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </Toggle>
          </div>
        </div>
      </div>

      {/* Photo Gallery */}
      <PhotoGallery
        photos={paginatedPhotos}
        labels={labels}
        selectedPhotoIds={selectedPhotoIds}
        onPhotoClick={handlePhotoClick}
        onLabelManage={handleLabelManage}
        onSelectionToggle={handleSelectionToggle}
        onUpdateLabels={updatePhotoLabels}
      />

      {/* Load More Button */}
      {hasMoreItems && (
        <div className="px-6 py-4 text-center">
          <Button onClick={loadMore} variant="outline">
            Carregar mais fotos
          </Button>
        </div>
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
        onCreateLabel={createLabel}
        onCreateAlbum={async (name, labels, coverPhotoUrl) => {
          const album = await createAlbum(name, labels, coverPhotoUrl);
          if (album) {
            toast.success('Coleção criada com sucesso!');
            setIsCreateAlbumOpen(false);
          } else {
            toast.error('Erro ao criar coleção');
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
              toast.success('Coleção atualizada com sucesso!');
              setIsEditAlbumOpen(false);
              setSelectedAlbum(null);
            } else {
              toast.error('Erro ao atualizar coleção');
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