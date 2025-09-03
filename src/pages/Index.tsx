// Force rebuild to fix updateFilters caching issue - timestamp: 1756513884740
import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { Upload, Library, FolderOpen, FolderPlus, Edit, Trash2, Grid3X3, List } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AppSidebar } from '@/components/AppSidebar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Toggle } from '@/components/ui/toggle';
import { CollectionFilter } from '@/components/CollectionFilter';
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
    deleteAlbum,
    getAlbumPhotos
  } = useAlbums();

  // Collection filter state
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [collectionPhotos, setCollectionPhotos] = useState<Photo[]>([]);

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
  } = usePhotoFilters(selectedCollectionId ? collectionPhotos : photos);

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
  const [isCreateCollectionFromSelectionOpen, setIsCreateCollectionFromSelectionOpen] = useState(false);
  const [isEditAlbumOpen, setIsEditAlbumOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);

  // View mode state
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [itemsPerPage, setItemsPerPage] = useState(24);

  // Label suggestions state
  const [labelSuggestions, setLabelSuggestions] = useState<{
    suggestions: string[];
    source: string;
    photo: Photo | null;
  }>({ suggestions: [], source: 'mock', photo: null });

  // Pagination
  const {
    currentPage,
    totalPages,
    paginatedItems: paginatedPhotos,
    reset
  } = usePagination(filteredPhotos, itemsPerPage);

  // Reset pagination when filtered photos change
  useEffect(() => {
    reset();
  }, [filteredPhotos, reset]);

  // Collection filter effect
  useEffect(() => {
    const fetchCollectionPhotos = async () => {
      if (selectedCollectionId) {
        const albumPhotos = await getAlbumPhotos(selectedCollectionId);
        // Convert to Photo type format
        const photos = albumPhotos.map(p => ({
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
        setCollectionPhotos(photos);
      } else {
        setCollectionPhotos([]);
      }
    };

    fetchCollectionPhotos();
  }, [selectedCollectionId, getAlbumPhotos]);

  // Handle collection change
  const handleCollectionChange = (collectionId: string | null) => {
    setSelectedCollectionId(collectionId);
    // Clear filters when changing collection to start fresh within the collection scope
    updateFilters({
      labels: [],
      searchTerm: '',
      showUnlabeled: false,
      dateRange: undefined,
      year: undefined,
      sortBy: 'date-desc',
      fileTypes: ['RAW', 'JPEG', 'PNG', 'MP4', 'MOV', 'AVI'],
      mediaTypes: ['photo', 'video']
    });
    clearSelection();
  };

  const handlePhotoClick = (photo: Photo) => {
    if (selectedCount > 0) {
      toggleSelection(photo.id);
    } else {
      setSelectedPhoto(photo);
      setIsModalOpen(true);
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedPhoto(null);
  };

  const handleBulkLabelManage = () => {
    setIsBulkLabelDialogOpen(true);
  };

  const handleSelectAll = () => {
    if (selectedCount === filteredPhotos.length && filteredPhotos.length > 0) {
      clearSelection();
    } else {
      selectAll(filteredPhotos);
    }
  };

  const handleBulkDelete = async () => {
    const selectedPhotos = getSelectedPhotos(photos);
    if (selectedPhotos.length === 0) return;
    
    if (!confirm(`Tem certeza que deseja excluir ${selectedPhotos.length} foto${selectedPhotos.length !== 1 ? 's' : ''}?`)) {
      return;
    }

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
          source: suggestions.source as 'mock' | 'ai',
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

  // Check if there are active filters (more comprehensive)
  const hasActiveFiltersDetailed = useMemo(() => {
    return (
      filters.labels.length > 0 ||
      filters.searchTerm.trim() !== '' ||
      filters.showUnlabeled ||
      showFavorites ||
      selectedCollectionId !== null ||
      filters.dateRange?.start || 
      filters.dateRange?.end ||
      filters.year ||
      filters.fileTypes.length > 0 ||
      filters.mediaTypes.length > 0
    );
  }, [filters, showFavorites, selectedCollectionId]);

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

  // Handle Create Collection from Stats
  const handleCreateCollectionFromStats = () => {
    setIsCreateAlbumOpen(true);
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Carregando fotos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-background">
      {/* CONTAINER 1: Coleções de Projetos */}
      <div className="container mx-auto px-4 pt-6 max-w-7xl mb-4">
        <CollectionFilter
          collections={albums}
          selectedCollectionId={selectedCollectionId}
          onCollectionChange={handleCollectionChange}
        />
      </div>

      {/* CONTAINER 2: Buscar Labels */}
      <div className="container mx-auto px-4 max-w-7xl mb-4">
        <SearchBar
          searchTerm={filters.searchTerm}
          onSearchChange={updateSearchTerm}
          onUpload={handleUpload}
          onToggleUnlabeled={toggleUnlabeled}
          showUnlabeled={filters.showUnlabeled}
          onLabelToggle={(labelId) => toggleLabel(labelId)}
          labels={labels}
          selectedLabels={filters.labels}
          onClearFilters={clearFilters}
          onManageLabels={() => setIsLabelManagerOpen(true)}
          onIncludeLabel={includeLabel}
          includedLabels={includedLabels}
          excludedLabels={excludedLabels}
        />
        
        {/* Related Labels Bar - Parte do container de labels */}
        <div className="mt-2">
          <RelatedLabelsBar
            relatedLabels={getRelatedLabels}
            allLabels={labels}
            includedLabels={includedLabels}
            excludedLabels={excludedLabels}
            onIncludeLabel={includeLabel}
            onExcludeLabel={excludeLabel}
            onRemoveLabel={removeLabel}
          />
        </div>
      </div>

      {/* CONTAINER 3: Filtros por Data e Avançados */}
      <div className="container mx-auto px-4 max-w-7xl mb-4">
        <HomeFiltersBar
          filters={filters}
          showFavorites={showFavorites}
          onUpdateFilters={updateFilters}
          onToggleFavorites={toggleFavorites}
        />
      </div>

      {/* CONTAINER 4: Relatório de Fotos/Vídeos e Controles */}
      <div className="container mx-auto px-4 max-w-7xl mb-6 mt-8">
        <div className="flex justify-between items-center mb-6">
          <PhotoStats 
            photos={filteredPhotos}
            onCreateCollection={hasActiveFiltersDetailed ? handleCreateCollectionFromStats : undefined}
          />
          
          <div className="flex items-center gap-4">
            {/* View Toggle */}
            <div className="flex items-center gap-2">
              <Toggle
                pressed={viewMode === 'grid'}
                onPressedChange={(pressed) => setViewMode(pressed ? 'grid' : 'list')}
                size="sm"
                aria-label="Vista em grade"
              >
                <Grid3X3 className="h-4 w-4" />
              </Toggle>
              <Toggle
                pressed={viewMode === 'list'}
                onPressedChange={(pressed) => setViewMode(pressed ? 'list' : 'grid')}
                size="sm"
                aria-label="Vista em lista"
              >
                <List className="h-4 w-4" />
              </Toggle>
            </div>

            {/* Items per page selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Por página:</span>
              <Select value={itemsPerPage.toString()} onValueChange={(value) => setItemsPerPage(parseInt(value))}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="12">12</SelectItem>
                  <SelectItem value="24">24</SelectItem>
                  <SelectItem value="48">48</SelectItem>
                  <SelectItem value="96">96</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Selection Panel */}
      {selectedCount > 0 && (
        <SelectionPanel
          selectedCount={selectedCount}
          onManageLabels={handleBulkLabelManage}
          onDeleteSelected={handleBulkDelete}
          onClearSelection={clearSelection}
          onCreateCollection={() => setIsCreateCollectionFromSelectionOpen(true)}
        />
      )}

      {/* Photo Gallery - Full width */}
      <div className="w-full">
        <PhotoGallery
          photos={paginatedPhotos}
          labels={labels}
          selectedPhotoIds={selectedPhotoIds}
          onPhotoClick={handlePhotoClick}
          onLabelManage={handleLabelManage}
          onSelectionToggle={(photoId, isShiftPressed) => toggleSelection(photoId)}
          onUpdateLabels={updatePhotoLabels}
        />
      </div>

      {/* Load More / Pagination */}
      {totalPages > 1 && (
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="mt-8 flex justify-center">
            <Button
              variant="outline"
              onClick={() => reset()}
              disabled={currentPage >= totalPages}
            >
              Carregar Mais
            </Button>
          </div>
        </div>
      )}

      {/* No photos state */}
      {!loading && filteredPhotos.length === 0 && (
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="text-center py-16">
            {photos.length === 0 ? (
              <div>
                <Library className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhuma foto encontrada</h3>
                <p className="text-muted-foreground mb-4">
                  Comece fazendo upload das suas primeiras fotos!
                </p>
                <Button onClick={handleUpload}>
                  <Upload className="mr-2 h-4 w-4" />
                  Fazer Upload
                </Button>
              </div>
            ) : (
              <div>
                <FolderOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhuma foto corresponde aos filtros</h3>
                <p className="text-muted-foreground mb-4">
                  Tente ajustar seus filtros ou remova algumas labels
                </p>
                <Button variant="outline" onClick={clearFilters}>
                  Limpar filtros
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upload Dialog */}
      <UploadDialog
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUpload={handleUploadFiles}
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
        open={isCreateAlbumOpen}
        onOpenChange={setIsCreateAlbumOpen}
        onCreate={async (name, photoIds) => {
          const album = await createAlbum(name, photoIds);
          if (album) {
            toast.success(`Coleção "${name}" criada com sucesso!`);
            setIsCreateAlbumOpen(false);
          } else {
            toast.error('Erro ao criar coleção');
          }
        }}
      />

      {/* Create Collection from Selection Dialog */}
      <CreateAlbumDialog
        open={isCreateCollectionFromSelectionOpen}
        onOpenChange={setIsCreateCollectionFromSelectionOpen}
        onCreate={async (name, photoIds) => {
          const selectedPhotosList = getSelectedPhotos(photos);
          const album = await createAlbum(name, selectedPhotosList.map(p => p.id));
          if (album) {
            toast.success(`Coleção "${name}" criada com ${selectedPhotosList.length} foto${selectedPhotosList.length !== 1 ? 's' : ''}!`);
            setIsCreateCollectionFromSelectionOpen(false);
            clearSelection();
          } else {
            toast.error('Erro ao criar coleção');
          }
        }}
        selectedPhotos={getSelectedPhotos(photos)}
      />

      {/* Edit Album Dialog */}
      {selectedAlbum && (
        <EditAlbumDialog
          open={isEditAlbumOpen}
          onOpenChange={(open) => {
            setIsEditAlbumOpen(open);
            if (!open) setSelectedAlbum(null);
          }}
          album={selectedAlbum}
          onUpdate={async (id, updates) => {
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
          source={labelSuggestions.source as 'mock' | 'ai'}
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