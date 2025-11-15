// Force rebuild to fix updateFilters caching issue - timestamp: 1756513884740
import { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { Upload, Library, FolderOpen, FolderPlus, Edit, Trash2, Grid3X3, List, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
import { useUnifiedCollections } from '@/hooks/useUnifiedCollections';
import { SearchBar } from '@/components/SearchBar';
import { RelatedLabelsBar } from '@/components/RelatedLabelsBar';
import { PhotoGallery } from '@/components/PhotoGallery';
import { PhotoStats } from '@/components/PhotoStats';
import { ActiveFileTypesFilter } from '@/components/ActiveFileTypesFilter';
import { SelectionPanel } from '@/components/SelectionPanel';
import { BulkLabelDialog } from '@/components/BulkLabelDialog';
import { DriveBulkDeleteDialog } from '@/components/DriveBulkDeleteDialog';
import { UploadDialog } from '@/components/UploadDialog';
import { LabelManager } from '@/components/LabelManager';
import { PhotoModal } from '@/components/PhotoModal';
import { MediaModal } from '@/components/MediaModal';
import { KeyboardShortcuts } from '@/components/KeyboardShortcuts';
import { LabelSuggestions } from '@/components/LabelSuggestions';
import { LoadingGallery } from '@/components/LoadingGallery';
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
import { DriveReauthBanner } from '@/components/DriveReauthBanner';
import { OrphanNotificationBanner } from '@/components/OrphanNotificationBanner';
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

  // Unified Collections (manual + drive folders)
  const { collections: unifiedCollections, loading: collectionsLoading } = useUnifiedCollections();

  // Collection filter state
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);

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
  const [isCreateCollectionFromSelectionOpen, setIsCreateCollectionFromSelectionOpen] = useState(false);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [isDeletingBulkFromDrive, setIsDeletingBulkFromDrive] = useState(false);
  const [showBulkDriveDeleteDialog, setShowBulkDriveDeleteDialog] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState({ current: 0, total: 0 });
  const [isEditAlbumOpen, setIsEditAlbumOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [selectedMediaItem, setSelectedMediaItem] = useState<MediaItem | null>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  // View mode state
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isLoadingThumbs, setIsLoadingThumbs] = useState(false);

  // Label suggestions state
  const [labelSuggestions, setLabelSuggestions] = useState<{
    suggestions: string[];
    source: string;
    photo: Photo | null;
  }>({ suggestions: [], source: 'mock', photo: null });

  // Unified media state
  const { 
    items: unifiedItems, 
    total: totalUnifiedFromAPI,
    totalPhotos: totalPhotosFromAPI,
    totalVideos: totalVideosFromAPI,
    loading: unifiedLoading, 
    needsDriveReauth,
    loadItems: loadUnifiedItems, 
    addLabel: addUnifiedLabel, 
    removeLabel: removeUnifiedLabel 
  } = useUnifiedMedia();
  const [unifiedMimeFilter, setUnifiedMimeFilter] = useState<"all" | "image" | "video">("all");

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

  // Pagination for unified items (must be after filteredUnifiedItems)
  const {
    paginatedItems: paginatedUnifiedItems,
    hasMoreItems,
    loadMore,
    reset: resetPagination,
    changeItemsPerPage,
    itemsPerPage,
    currentlyShowing,
    totalItems: totalUnifiedItems
  } = usePagination(filteredUnifiedItems, 24);

  // Helper function to load items with current settings
  const loadCurrentItems = useCallback(async () => {
    setIsLoadingThumbs(true);
    
    const toastId = toast.loading(
      `Carregando ${itemsPerPage} items...`,
      { description: 'Gerando thumbnails...' }
    );
    
    try {
      // Parse selectedCollectionId to determine filter type
      let collectionId: string | undefined;
      let driveOriginFolder: string | undefined;
      let originStatus: "active" | "missing" | "permanently_deleted" | undefined;
      
      if (selectedCollectionId) {
        if (selectedCollectionId === 'orphans') {
          // Orphans filter
          originStatus = 'missing';
        } else if (selectedCollectionId.startsWith('drive:')) {
          // Drive origin folder filter
          driveOriginFolder = selectedCollectionId.replace('drive:', '');
        } else {
          // Manual collection filter
          collectionId = selectedCollectionId;
        }
      }
      
      const params = {
        page: 1,
        pageSize: itemsPerPage,
        source: "all" as const,
        mimeClass: unifiedMimeFilter,
        collectionId,
        driveOriginFolder,
        originStatus
      };
      await loadUnifiedItems(params);
      
      toast.success('Items carregados!', { id: toastId });
    } catch (error) {
      toast.error('Erro ao carregar items', { id: toastId });
    } finally {
      setIsLoadingThumbs(false);
    }
  }, [itemsPerPage, unifiedMimeFilter, selectedCollectionId, loadUnifiedItems]);

  // Load unified media items when itemsPerPage or mime filter changes
  useEffect(() => {
    loadCurrentItems();
  }, [loadCurrentItems]);

  // Listen for reauth completion event
  useEffect(() => {
    const handleReauthComplete = () => {
      console.log('[Index] Reauth completed, reloading items...');
      loadCurrentItems();
    };

    const handleSelectOrphans = () => {
      console.log('[Index] Selecting orphans collection...');
      setSelectedCollectionId('orphans');
    };

    window.addEventListener('drive:reauth:complete', handleReauthComplete);
    window.addEventListener('select-orphans-collection', handleSelectOrphans);
    
    return () => {
      window.removeEventListener('drive:reauth:complete', handleReauthComplete);
      window.removeEventListener('select-orphans-collection', handleSelectOrphans);
    };
  }, [loadCurrentItems]);

  // Debug log for itemsPerPage changes
  useEffect(() => {
    console.log('📄 Items per page changed:', itemsPerPage);
  }, [itemsPerPage]);

  // Reset pagination when filters change
  useEffect(() => {
    resetPagination();
  }, [filteredUnifiedItems.length, resetPagination]);

  // Debug pagination values
  useEffect(() => {
    console.log('🔍 Pagination Debug:', {
      total: filteredUnifiedItems.length,
      showing: paginatedUnifiedItems.length,
      itemsPerPage,
      hasMoreItems,
      currentlyShowing,
      totalUnifiedItems
    });
  }, [filteredUnifiedItems.length, paginatedUnifiedItems.length, itemsPerPage, hasMoreItems, currentlyShowing, totalUnifiedItems]);

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
      // Always use full item.id for consistent selection
      toggleSelection(item.id);
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
      await loadCurrentItems();
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
    if (selectedCount === filteredUnifiedItems.length && filteredUnifiedItems.length > 0) {
      clearSelection();
    } else {
      // Convert MediaItems to Photo format for selection - use full item.id
      const photosToSelect = filteredUnifiedItems.map(item => ({
        id: item.id, // Full ID with prefix (db:xxx or gdrive:xxx)
        name: item.name,
        url: item.posterUrl || '',
        labels: item.labels.map(l => l.id),
        uploadDate: item.createdAt || new Date().toISOString(),
        originalDate: item.createdAt,
        alias: null,
        mediaType: item.isVideo ? 'video' as const : 'photo' as const
      }));
      selectAll(photosToSelect);
    }
  };

  const handleBulkDelete = () => {
    if (selectedCount === 0) return;
    setIsDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    setIsDeleteConfirmOpen(false);
    
    if (selectedCount === 0) return;

    const selectedItems = unifiedItems.filter(item => selectedPhotoIds.has(item.id));

    console.log('🗑️ Delete operation:', {
      selectedPhotoIds: Array.from(selectedPhotoIds),
      selectedItems: selectedItems.map(i => ({ id: i.id, name: i.name, source: i.source })),
      totalUnifiedItems: unifiedItems.length
    });

    if (selectedItems.length === 0) {
      toast.error("Nenhum item selecionado para deletar");
      return;
    }

    // Iniciar loading state
    setIsDeletingBulk(true);
    setDeleteProgress({ current: 0, total: selectedItems.length });
    
    // Toast inicial
    const toastId = toast.loading(`Deletando 0/${selectedItems.length} arquivos...`);

    let successCount = 0;

    // Processamento paralelo (batch de 5)
    const batchSize = 5;
    for (let i = 0; i < selectedItems.length; i += batchSize) {
      const batch = selectedItems.slice(i, i + batchSize);
      
      const results = await Promise.allSettled(
        batch.map(item => {
          console.log('🗑️ Deleting item:', item.id, item.source);
          return supabase.functions.invoke('delete-unified-item', {
            body: { itemId: item.id }
          });
        })
      );

      // Contar sucessos
      results.forEach((result, idx) => {
        if (result.status === 'fulfilled' && !result.value.error) {
          console.log('✅ Item deleted:', batch[idx].id);
          successCount++;
        } else {
          console.error('❌ Error deleting item:', batch[idx].id, result.status === 'fulfilled' ? result.value.error : result.reason);
        }
      });

      // Atualizar progresso
      const currentProgress = Math.min(i + batchSize, selectedItems.length);
      setDeleteProgress({ current: currentProgress, total: selectedItems.length });
      toast.loading(`Deletando ${currentProgress}/${selectedItems.length} arquivos...`, { id: toastId });
    }

    // Finalizar loading state
    setIsDeletingBulk(false);
    setDeleteProgress({ current: 0, total: 0 });
    
    clearSelection();
    
    // Reload unified items after deletion
    await loadCurrentItems();

    // Toast final
    toast.dismiss(toastId);
    if (successCount === selectedItems.length) {
      toast.success(`${successCount} arquivo${successCount !== 1 ? 's' : ''} deletado${successCount !== 1 ? 's' : ''} com sucesso!`);
    } else {
      toast.error(`${successCount} de ${selectedItems.length} arquivos foram deletados.`);
    }
  };

  const handleBulkApplyLabels = async (assetIds: string[], labelIds: string[]) => {
    const toastId = toast.loading(`Aplicando labels em ${assetIds.length} items...`);
    
    try {
      const { data, error } = await supabase.functions.invoke('labels-apply-bulk', {
        body: { 
          assetIds, 
          toAdd: labelIds, 
          toRemove: [] 
        }
      });
      
      if (error) throw error;
      
      // Reload items after bulk operation
      await loadCurrentItems();
      
      toast.dismiss(toastId);
      
      if (data?.failed && data.failed > 0) {
        toast.warning(`Labels aplicadas em ${data.applied || 0} items. ${data.failed} falharam.`);
        console.error('Failed items:', data.errors);
      } else {
        toast.success(`Labels aplicadas em ${assetIds.length} items!`);
      }
    } catch (error) {
      console.error('Error applying labels:', error);
      toast.dismiss(toastId);
      toast.error('Erro ao aplicar labels');
    }
  };

  const handleBulkRemoveLabels = async (assetIds: string[], labelIds: string[]) => {
    const toastId = toast.loading(`Removendo labels de ${assetIds.length} items...`);
    
    try {
      const { data, error } = await supabase.functions.invoke('labels-apply-bulk', {
        body: { 
          assetIds, 
          toAdd: [], 
          toRemove: labelIds 
        }
      });
      
      if (error) throw error;
      
      // Reload items after bulk operation
      await loadCurrentItems();
      
      toast.dismiss(toastId);
      
      if (data?.failed && data.failed > 0) {
        toast.warning(`Labels removidas de ${data.removed || 0} items. ${data.failed} falharam.`);
        console.error('Failed items:', data.errors);
      } else {
        toast.success(`Labels removidas de ${assetIds.length} items!`);
      }
    } catch (error) {
      console.error('Error removing labels:', error);
      toast.dismiss(toastId);
      toast.error('Erro ao remover labels');
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
          collections={unifiedCollections}
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
        {/* Orphan Notification Banner */}
        <OrphanNotificationBanner />
        
        {/* Drive Reauth Banner */}
        {needsDriveReauth && (
          <DriveReauthBanner onReauthComplete={() => {
            loadCurrentItems();
          }} />
        )}
        
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
              items={paginatedUnifiedItems}
              totalPhotos={totalPhotosFromAPI || 0}
              totalVideos={totalVideosFromAPI || 0}
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
            <Card className="p-2 bg-accent/20">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Por página:</span>
                <Select 
                  value={itemsPerPage.toString()} 
                  onValueChange={(value) => changeItemsPerPage(parseInt(value))}
                >
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
            </Card>
          </div>
        </div>
      </div>

      {/* Selection Panel */}
      {selectedCount > 0 && (
        <SelectionPanel
          selectedCount={selectedCount}
          totalCount={totalUnifiedItems}
          onManageLabels={handleBulkLabelManage}
          onDeleteSelected={handleBulkDelete}
          onClearSelection={clearSelection}
          onSelectAll={handleSelectAll}
          onCreateCollection={() => {
            setIsCreateCollectionFromSelectionOpen(true);
          }}
          isDeleting={isDeletingBulk}
          deleteProgress={deleteProgress}
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
        {isLoadingThumbs ? (
          <div className="container mx-auto px-4 max-w-7xl">
            <LoadingGallery count={itemsPerPage} />
          </div>
        ) : unifiedLoading ? (
          <div className="container mx-auto px-4 max-w-7xl">
            <div className="text-center py-8">
              <p className="text-muted-foreground">Carregando itens...</p>
            </div>
          </div>
        ) : (
          <div className="w-full">
            <div className="container mx-auto px-4 max-w-7xl">
              {/* PhotoStats - só mostrar quando não está carregando */}
              {paginatedUnifiedItems.length > 0 && (
                <PhotoStats 
                  items={paginatedUnifiedItems}
                  totalPhotos={totalPhotosFromAPI || 0}
                  totalVideos={totalVideosFromAPI || 0}
                />
              )}
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {paginatedUnifiedItems.map((item) => (
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
              
              {/* Pagination info and Load More button */}
              {paginatedUnifiedItems.length > 0 && (
                <div className="mt-8 flex flex-col items-center gap-4 py-6 border-t">
                  <div className="text-center">
                    <p className="text-lg font-medium mb-1">
                      Mostrando {currentlyShowing} de {totalUnifiedItems} {totalUnifiedItems === 1 ? 'arquivo' : 'arquivos'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {hasMoreItems 
                        ? `Ainda há ${totalUnifiedItems - currentlyShowing} ${totalUnifiedItems - currentlyShowing === 1 ? 'arquivo' : 'arquivos'} para carregar`
                        : 'Todos os arquivos foram carregados'}
                    </p>
                  </div>
                  
                  {hasMoreItems && (
                    <Button
                      onClick={loadMore}
                      variant="default"
                      size="lg"
                      className="min-w-[250px] h-12"
                    >
                      Carregar mais {Math.min(itemsPerPage, totalUnifiedItems - currentlyShowing)} {Math.min(itemsPerPage, totalUnifiedItems - currentlyShowing) === 1 ? 'item' : 'itens'}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* No items state */}
      {!unifiedLoading && paginatedUnifiedItems.length === 0 && (
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
        selectedItems={unifiedItems.filter(item => selectedPhotoIds.has(item.id))}
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
          onDeleteFromDrive={undefined}
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