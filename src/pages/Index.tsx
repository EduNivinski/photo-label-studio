// Force rebuild to fix updateFilters caching issue - timestamp: 1756513884740
import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { Upload, Library, FolderOpen, FolderPlus, Edit, Trash2, Grid3X3, List, ExternalLink } from 'lucide-react';
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
import { ActiveFileTypesFilter } from '@/components/ActiveFileTypesFilter';
import { SelectionPanel } from '@/components/SelectionPanel';
import { BulkLabelDialog } from '@/components/BulkLabelDialog';
import { UploadDialog } from '@/components/UploadDialog';
import { LabelManager } from '@/components/LabelManager';
import { PhotoModal } from '@/components/PhotoModal';
import { MediaModal } from '@/components/MediaModal';
import { KeyboardShortcuts } from '@/components/KeyboardShortcuts';
import { LabelSuggestions } from '@/components/LabelSuggestions';
import { CreateAlbumDialog } from '@/components/CreateAlbumDialog';
import { EditAlbumDialog } from '@/components/EditAlbumDialog';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';
import { DateFilters } from '@/components/DateFilters';
import { AdvancedFilters } from '@/components/AdvancedFilters';
import { HomeFiltersBar } from '@/components/HomeFiltersBar';
import DriveSyncBadge from '@/components/DriveSyncBadge';
import GDriveThumb from '@/components/GDriveThumb';
import { DriveItemGallery } from '@/components/Drive/DriveItemGallery';
import { UnifiedPhotoCard } from '@/components/UnifiedPhotoCard';
import { useUnifiedMedia } from '@/hooks/useUnifiedMedia';
import { extractSourceAndKey } from '@/lib/media-adapters';
import { supabase } from '@/integrations/supabase/client';
import type { Photo } from '@/types/photo';
import type { Album } from '@/types/album';
import type { MediaItem } from '@/types/media';

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
    toggleFavorites,
    toggleFileType
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
  const [selectedMediaItem, setSelectedMediaItem] = useState<MediaItem | null>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  // View mode state
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [itemsPerPage, setItemsPerPage] = useState(24);

  // Label suggestions state
  const [labelSuggestions, setLabelSuggestions] = useState<{
    suggestions: string[];
    source: string;
    photo: Photo | null;
  }>({ suggestions: [], source: 'mock', photo: null });

  // Unified media state
  const { items: unifiedItems, loading: unifiedLoading, loadItems: loadUnifiedItems, addLabel: addUnifiedLabel, removeLabel: removeUnifiedLabel } = useUnifiedMedia();
  const [unifiedMimeFilter, setUnifiedMimeFilter] = useState<"all" | "image" | "video">("all");

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
  }, [filteredPhotos.length]); // Remove reset from dependencies to avoid loop

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

  // Stable params for unified media items
  const unifiedParams = useMemo(() => ({
    page: 1,
    pageSize: 50,
    source: "all" as const,
    mimeClass: unifiedMimeFilter
  }), [unifiedMimeFilter]);

  // Load unified media items - always load on mount
  useEffect(() => {
    loadUnifiedItems(unifiedParams);
  }, [unifiedParams, loadUnifiedItems]);

  // Apply client-side filters to unified items so home reflects label filters immediately
  const filteredUnifiedItems = useMemo(() => {
    const required = [...filters.labels, ...includedLabels];
    return unifiedItems.filter((item) => {
      const itemLabelIds = item.labels.map(l => l.id);
      const matchesRequired = required.length === 0 || required.every(id => itemLabelIds.includes(id));
      const matchesExcluded = excludedLabels.length === 0 || !excludedLabels.some(id => itemLabelIds.includes(id));
      const matchesSearch = filters.searchTerm.trim() === '' || item.name.toLowerCase().includes(filters.searchTerm.toLowerCase());
      const matchesUnlabeled = !filters.showUnlabeled || itemLabelIds.filter(id => id !== 'favorites').length === 0;
      return matchesRequired && matchesExcluded && matchesSearch && matchesUnlabeled;
    });
  }, [unifiedItems, filters.labels, filters.searchTerm, filters.showUnlabeled, includedLabels, excludedLabels]);

  // Ensure no legacy Drive loading variables exist
  const driveLoading = false; // Deprecated - always use unifiedLoading

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

  const handleUnifiedItemClick = async (item: MediaItem) => {
    if (selectedCount > 0) {
      const { source, key } = extractSourceAndKey(item.id);
      toggleSelection(source === 'db' ? key : item.id);
    } else {
      console.log('🔍 Opening MediaModal for item:', {
        id: item.id,
        name: item.name,
        source: item.source,
        isVideo: item.isVideo,
        posterUrl: item.posterUrl
      });
      
      // Use MediaModal directly for unified items (new high-res preview system)
      setSelectedMediaItem(item);
      setSelectedPhoto(null);
      setIsModalOpen(true);
    }
  };

  // Unified function to handle both Photo and MediaItem label updates
  const handleUnifiedUpdateLabels = async (itemId: string, labelIds: string[]): Promise<boolean> => {
    const { source } = extractSourceAndKey(itemId);
    let success = false;

    try {
      // Find current item labels from unifiedItems
      const currentItem = unifiedItems.find(item => item.id === itemId);

      // Remove all existing labels via unified API (works for both DB and GDrive)
      if (currentItem) {
        for (const existingLabel of currentItem.labels) {
          await removeUnifiedLabel(itemId, existingLabel.id);
        }
      }

      // Add the new set of labels
      for (const lid of labelIds) {
        await addUnifiedLabel(itemId, lid);
      }

      success = true;
    } catch (error) {
      console.error('Error updating item labels:', error);
      success = false;
    }

    // Always reload unified items after any label update to reflect changes in UI
    if (success) {
      await loadUnifiedItems(unifiedParams);
    }

    return success;
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedPhoto(null);
    setSelectedMediaItem(null);
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

  const handleBulkDelete = () => {
    if (selectedCount === 0) return;
    setIsDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    setIsDeleteConfirmOpen(false);
    
    if (selectedCount === 0) return;

    // Get selected items from unified items
    const selectedItems = unifiedItems.filter(item => {
      const { source, key } = extractSourceAndKey(item.id);
      return selectedPhotoIds.has(source === 'db' ? key : item.id);
    });

    if (selectedItems.length === 0) {
      toast.error("Nenhum item selecionado para deletar");
      return;
    }

    let successCount = 0;
    const totalItems = selectedItems.length;

    for (const item of selectedItems) {
      try {
        const { data, error } = await supabase.functions.invoke('delete-unified-item', {
          body: { itemId: item.id }
        });

        if (error) {
          console.error('Error deleting item:', error);
        } else {
          successCount++;
        }
      } catch (error) {
        console.error('Error deleting item:', error);
      }
    }

    clearSelection();
    
    // Reload unified items after deletion
    loadUnifiedItems(unifiedParams);

    if (successCount === totalItems) {
      toast.success(`${successCount} arquivo${successCount !== 1 ? 's' : ''} deletado${successCount !== 1 ? 's' : ''} com sucesso!`);
    } else {
      toast.error(`Erro ao deletar alguns arquivos. ${successCount} de ${totalItems} foram deletados.`);
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
    
    // Reload unified items after upload
    loadUnifiedItems({
      page: 1,
      pageSize: 50,
      source: "all",
      mimeClass: unifiedMimeFilter
    });
    
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

  const handleLabelManage = (photo?: Photo | MediaItem) => {
    if (photo) {
      if ('source' in photo) {
        // MediaItem - convert to Photo for compatibility
        const convertedPhoto: Photo = {
          id: photo.id,
          name: photo.name,
          url: photo.posterUrl || '',
          labels: photo.labels.map(l => l.id),
          uploadDate: photo.createdAt || new Date().toISOString(),
          originalDate: photo.createdAt,
          alias: null,
          mediaType: photo.isVideo ? 'video' : 'photo'
        };
        setSelectedPhoto(convertedPhoto);
      } else {
        setSelectedPhoto(photo);
      }
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

  // Filter labels based on selected collection
  const availableLabels = useMemo(() => {
    if (!selectedCollectionId || collectionPhotos.length === 0) {
      return labels;
    }

    // Get unique label IDs from collection photos
    const collectionLabelIds = new Set<string>();
    collectionPhotos.forEach(photo => {
      photo.labels.forEach(labelId => collectionLabelIds.add(labelId));
    });

    // Filter labels to only include those present in the collection
    return labels.filter(label => collectionLabelIds.has(label.id));
  }, [labels, selectedCollectionId, collectionPhotos]);

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
      {/* HEADER: Photo Label Title */}
      <header className="border-b border-border/50 bg-card/30 backdrop-blur-sm">
        <div className="container mx-auto px-4 p-4 max-w-7xl">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-3xl font-bold text-foreground tracking-tight">
                Photo Label
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* CONTAINER 1: Coleções de Projetos */}
      <div className="container mx-auto px-4 pt-6 max-w-7xl mb-4">
        <CollectionFilter
          collections={albums}
          selectedCollectionId={selectedCollectionId}
          onCollectionChange={handleCollectionChange}
        />
      </div>

      {/* Drive Sync Badge */}
      <div className="container mx-auto px-4 max-w-7xl">
        <DriveSyncBadge />
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
          labels={availableLabels}
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
            allLabels={availableLabels}
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
          <div className="flex items-center gap-4">
            {hasActiveFiltersDetailed && (
              <Button
                onClick={handleCreateCollectionFromStats}
                variant="create"
                size="sm"
                className="flex items-center gap-2"
              >
                <FolderPlus size={16} />
                Criar Coleção
              </Button>
            )}
            
            <ActiveFileTypesFilter
              photos={filteredPhotos}
              onToggleFileType={toggleFileType}
              activeFileTypes={filters.fileTypes}
            />
          </div>
          
          <div className="flex items-center gap-6">
            <PhotoStats 
              photos={filteredPhotos}
            />
            
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

      {/* Main Gallery - Always Unified */}
      <div className="w-full">
        {/* Mime Type Filter */}
        <div className="container mx-auto px-4 max-w-7xl mb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Mostrar:</span>
            <Select value={unifiedMimeFilter} onValueChange={(value: "all" | "image" | "video") => setUnifiedMimeFilter(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="image">Fotos</SelectItem>
                <SelectItem value="video">Vídeos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Unified Items Grid */}
        {unifiedLoading ? (
          <div className="container mx-auto px-4 max-w-7xl">
            <div className="text-center py-8">
              <p className="text-muted-foreground">Carregando itens...</p>
            </div>
          </div>
        ) : (
          <div className="w-full">
            <div className="container mx-auto px-4 max-w-7xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredUnifiedItems.map((item) => (
                  <UnifiedPhotoCard
                    key={item.id}
                    item={item}
                    labels={labels}
                    isSelected={isSelected(item.id)}
                    hasActiveSelections={selectedCount > 0}
                    onClick={() => handleUnifiedItemClick(item)}
                    onLabelManage={() => handleLabelManage(item)}
                    onSelectionToggle={(isShiftPressed) => toggleSelection(item.id)}
                    onUpdateLabels={handleUnifiedUpdateLabels}
                  />
                ))}
              </div>
              
              {/* Total count display */}
              {filteredUnifiedItems.length > 0 && (
                <div className="mt-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    {filteredUnifiedItems.length} {filteredUnifiedItems.length === 1 ? 'arquivo encontrado' : 'arquivos encontrados'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* No items state */}
      {!unifiedLoading && filteredUnifiedItems.length === 0 && (
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
        onUpdatePhotoLabels={handleUnifiedUpdateLabels}
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

      {/* Photo Modal - Legacy */}
      {selectedPhoto && !selectedMediaItem && (
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

      {/* Media Modal - New Unified System */}
      {selectedMediaItem && !selectedPhoto && (
        <MediaModal
          item={selectedMediaItem}
          labels={labels}
          isOpen={isModalOpen}
          onClose={handleModalClose}
          onLabelManage={() => handleLabelManage(selectedMediaItem)}
          onCreateLabel={createLabel}
          onDeleteLabel={deleteLabel}
          onUpdatePhotoLabels={handleUnifiedUpdateLabels}
          onDelete={async () => {
            if (!selectedMediaItem) return;
            
            try {
              const { data, error } = await supabase.functions.invoke('delete-unified-item', {
                body: { itemId: selectedMediaItem.id }
              });

              if (error) {
                console.error('Error deleting item:', error);
                toast.error("Erro ao excluir item");
                return;
              }

              toast.success("Item excluído com sucesso!");
              handleModalClose();
              // Reload unified items
              await loadUnifiedItems({ 
                page: 1, 
                pageSize: 50, 
                source: "all", 
                mimeClass: unifiedMimeFilter 
              });
            } catch (error) {
              console.error('Error deleting item:', error);
              toast.error("Erro ao excluir item");
            }
          }}
          onUpdateAlias={async (itemId: string, alias: string) => {
            const { source, key } = extractSourceAndKey(itemId);
            if (source === 'db') {
              await updatePhotoAlias(key, alias);
              // Update the selected item with new alias
              setSelectedMediaItem(prev => prev ? { ...prev, name: alias } : null);
              // Reload unified items
              await loadUnifiedItems({ 
                page: 1, 
                pageSize: 50, 
                source: "all", 
                mimeClass: unifiedMimeFilter 
              });
            } else {
              toast.info('Não é possível alterar nome de itens do Google Drive');
            }
          }}
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
        selectedPhotos={filteredPhotos}
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

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={isDeleteConfirmOpen}
        onOpenChange={setIsDeleteConfirmOpen}
        onConfirm={handleConfirmDelete}
        itemCount={selectedCount}
      />
    </div>
  );
};

export default Index;