import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Save, Plus, Archive, Upload, FolderOpen, FolderPlus, Edit, Trash2, TagIcon, Filter, Grid3X3, List, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PhotoGallery } from '@/components/PhotoGallery';
import { SelectionPanel } from '@/components/SelectionPanel';
import { CreateAlbumDialog } from '@/components/CreateAlbumDialog';
import { BulkLabelDialog } from '@/components/BulkLabelDialog';
import { LabelManager } from '@/components/LabelManager';
import { StandardLabelCreator } from '@/components/StandardLabelCreator';
import { HorizontalCarousel } from '@/components/HorizontalCarousel';
import { UnlabeledPhotosSection } from '@/components/UnlabeledPhotosSection';
import { SmartSuggestionsSection } from '@/components/SmartSuggestionsSection';
import { UploadDialog } from '@/components/UploadDialog';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { MobileSearchOverlay } from '@/components/MobileSearchOverlay';
import { NavigationHub } from '@/components/NavigationHub';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Toggle } from '@/components/ui/toggle';
import { useSupabaseData } from '@/hooks/useSupabaseData';
import { useAdvancedFilters } from '@/hooks/useAdvancedFilters';
import { usePhotoSelection } from '@/hooks/usePhotoSelection';
import { usePagination } from '@/hooks/usePagination';
import { useAlbums } from '@/hooks/useAlbums';
import { useToast } from '@/hooks/use-toast';
import { PhotoModal } from '@/components/PhotoModal';
import type { Photo, PhotoFilters } from '@/types/photo';
import type { Album } from '@/types/album';

interface LibraryExplorerProps {
  filters?: PhotoFilters;
  filteredPhotos?: Photo[];
  showFavorites?: boolean;
  updateFilters?: (updates: Partial<PhotoFilters>) => void;
  toggleLabel?: (labelId: string) => void;
  toggleFileType?: (fileType: string) => void;
  toggleMediaType?: (mediaType: string) => void;
  toggleFavorites?: () => void;
  clearFilters?: () => void;
}

export default function LibraryExplorer(props: LibraryExplorerProps = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { 
    photos, 
    labels, 
    loading, 
    updatePhotoLabels, 
    deletePhoto, 
    createLabel,
    applyLabelsToPhotos,
    uploadPhotos
  } = useSupabaseData();

  const { 
    selectedPhotoIds, 
    selectedCount, 
    isSelected, 
    toggleSelection, 
    selectAll, 
    clearSelection, 
    getSelectedPhotos 
  } = usePhotoSelection();

  // Check if we're receiving global filters from App.tsx
  const isUsingGlobalFilters = !!props.filteredPhotos;
  
  console.log('LibraryExplorer: isUsingGlobalFilters =', isUsingGlobalFilters);
  console.log('LibraryExplorer: props.showFavorites =', props.showFavorites);
  console.log('LibraryExplorer: props.filteredPhotos length =', props.filteredPhotos?.length);
  
  // Use local filters only if no global filters provided
  const localFiltersHook = !isUsingGlobalFilters ? useAdvancedFilters(photos) : null;
  
  const filters = isUsingGlobalFilters ? props.filters : localFiltersHook?.filters;
  const filteredPhotos = isUsingGlobalFilters ? props.filteredPhotos : localFiltersHook?.filteredPhotos || photos;
  const showFavorites = isUsingGlobalFilters ? props.showFavorites : localFiltersHook?.showFavorites || false;
  const updateFilters = isUsingGlobalFilters ? props.updateFilters : localFiltersHook?.updateFilters;
  const updateSearchTerm = localFiltersHook?.updateSearchTerm;
  const toggleLabel = isUsingGlobalFilters ? props.toggleLabel : localFiltersHook?.toggleLabel;
  const toggleFileType = isUsingGlobalFilters ? props.toggleFileType : localFiltersHook?.toggleFileType;
  const toggleMediaType = isUsingGlobalFilters ? props.toggleMediaType : localFiltersHook?.toggleMediaType;
  const toggleFavorites = isUsingGlobalFilters ? props.toggleFavorites : localFiltersHook?.toggleFavorites;
  const clearFilters = isUsingGlobalFilters ? props.clearFilters : localFiltersHook?.clearFilters;
  
  console.log('LibraryExplorer: final showFavorites =', showFavorites);
  console.log('LibraryExplorer: final filteredPhotos length =', filteredPhotos?.length);

  const {
    paginatedItems: paginatedPhotos,
    hasMoreItems,
    loadMore,
    changeItemsPerPage,
    itemsPerPage,
    currentlyShowing,
    totalItems
  } = usePagination(filteredPhotos, 30);

  const { albums, createAlbum, updateAlbum, deleteAlbum } = useAlbums();
  const { toast } = useToast();

  // Dialog states
  const [showCreateAlbum, setShowCreateAlbum] = useState(false);
  const [showBulkLabel, setShowBulkLabel] = useState(false);
  const [showLabelManager, setShowLabelManager] = useState(false);
  const [showLabelCreator, setShowLabelCreator] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showEditAlbum, setShowEditAlbum] = useState(false);
  const [selectedPhotoForLabels, setSelectedPhotoForLabels] = useState<string | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPhotoForModal, setSelectedPhotoForModal] = useState<any | null>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  
  // View states for new home design
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showUnlabeledFilter, setShowUnlabeledFilter] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);

  // Check for recent filter parameter
  useEffect(() => {
    const filterParam = searchParams.get('filter');
    if (filterParam === 'recent' && updateFilters) {
      // Apply recent filter (last 24 hours)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      updateFilters({
        sortBy: 'date-desc',
        dateRange: {
          start: yesterday,
          end: new Date()
        }
      });

      // Clear the URL parameter
      setSearchParams({});
      
      toast({
        title: "Filtro aplicado",
        description: "Mostrando fotos adicionadas nas últimas 24 horas",
      });
    }
  }, [searchParams, updateFilters, setSearchParams, toast]);

  // Check if there are active filters
  const hasActiveFilters = filters?.labels.length > 0 || filters?.searchTerm || showFavorites || showUnlabeledFilter;
  
  // Get unlabeled photos for the filter
  const unlabeledPhotos = useMemo(() => 
    photos.filter(photo => photo.labels.filter(label => label !== 'favorites').length === 0),
    [photos]
  );

  // Get photos that match current filters for album creation
  const photosForAlbum = useMemo(() => {
    if (!hasActiveFilters) return [];
    return filteredPhotos;
  }, [hasActiveFilters, filteredPhotos]);

  const handlePhotoClick = (photo: any) => {
    setSelectedPhotoForModal(photo);
    setShowPhotoModal(true);
  };

  const handleLabelManage = (photo: any) => {
    setSelectedPhotoForLabels(photo.id);
    setShowLabelManager(true);
  };

  const handleSelectionToggle = (photoId: string, isShiftPressed: boolean) => {
    toggleSelection(photoId, isShiftPressed, filteredPhotos);
  };

  const handleUpdateLabels = async (photoId: string, labelIds: string[]) => {
    const result = await updatePhotoLabels(photoId, labelIds);
    return result;
  };

  const handleBulkLabelManage = () => {
    setShowBulkLabel(true);
  };

  const handleDeleteSelected = async () => {
    const selectedPhotos = getSelectedPhotos(photos);
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

  const handleCreateAlbumFromFilters = async (name: string, labels: string[], coverPhotoUrl?: string) => {
    try {
      await createAlbum(name, labels, coverPhotoUrl);
      toast({
        title: "Coleção criada com sucesso! 🎉",
        description: `A coleção "${name}" foi criada e está disponível na sua Home.`,
      });
      setShowCreateAlbum(false);
    } catch (error) {
      toast({
        title: "Erro ao criar coleção",
        description: "Ocorreu um erro ao criar a coleção. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleApplyBulkLabels = async (photoIds: string[], labelIds: string[]) => {
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
    clearSelection();
    
    if (successCount === photoIds.length) {
      toast({
        title: "Labels aplicadas",
        description: `Labels foram aplicadas a ${photoIds.length} foto(s).`,
      });
    } else {
      toast({
        title: "Erro ao aplicar labels",
        description: `Erro ao aplicar labels em algumas fotos. ${successCount} de ${photoIds.length} foram processadas.`,
        variant: "destructive",
      });
    }
  };

  const handleRemoveBulkLabels = async (photoIds: string[], labelIds: string[]) => {
    // Implementation for removing labels from photos
    for (const photoId of photoIds) {
      const photo = photos.find(p => p.id === photoId);
      if (photo) {
        const updatedLabels = photo.labels.filter(labelId => !labelIds.includes(labelId));
        await updatePhotoLabels(photoId, updatedLabels);
      }
    }
    clearSelection();
    toast({
      title: "Labels removidas",
      description: `Labels foram removidas de ${photoIds.length} foto(s).`,
    });
  };

  const handleCreateLabel = async (name: string, color?: string) => {
    await createLabel(name, color);
    toast({
      title: "Label criada",
      description: `A label "${name}" foi criada com sucesso.`,
    });
  };

  const handleDeletePhoto = async () => {
    if (!selectedPhotoForModal) return;
    
    const success = await deletePhoto(selectedPhotoForModal.id);
    if (success) {
      setShowPhotoModal(false);
      setSelectedPhotoForModal(null);
      toast({
        title: "Foto deletada",
        description: "A foto foi deletada com sucesso.",
      });
    } else {
      toast({
        title: "Erro",
        description: "Erro ao deletar a foto.",
        variant: "destructive",
      });
    }
  };

  // Album management handlers
  const handleAlbumClick = (album: Album) => {
    // Apply album filters (labels associated with the album)
    album.labels.forEach(labelId => {
      if (!filters?.labels.includes(labelId)) {
        toggleLabel?.(labelId);
      }
    });
  };

  const handleEditAlbum = (album: Album) => {
    setSelectedAlbum(album);
    setShowEditAlbum(true);
  };

  const handleDeleteAlbum = async (albumId: string) => {
    const confirmed = confirm('Tem certeza que deseja deletar esta coleção?');
    if (confirmed) {
      const success = await deleteAlbum(albumId);
      if (success) {
        toast({
          title: "Coleção deletada",
          description: "A coleção foi deletada com sucesso.",
        });
      } else {
        toast({
          title: "Erro",
          description: "Erro ao deletar coleção.",
          variant: "destructive",
        });
      }
    }
  };

  const handleUploadFiles = async (files: File[]) => {
    const uploadedPhotos = await uploadPhotos(files);
    if (uploadedPhotos && uploadedPhotos.length > 0) {
      toast({
        title: "Upload concluído!",
        description: `${uploadedPhotos.length} arquivo(s) enviado(s) com sucesso.`,
      });
    }
  };

  const handleToggleUnlabeledFilter = () => {
    if (showUnlabeledFilter) {
      setShowUnlabeledFilter(false);
      // Clear unlabeled filter if active
      updateFilters?.({ showUnlabeled: false });
    } else {
      setShowUnlabeledFilter(true);
      updateFilters?.({ showUnlabeled: true });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando biblioteca...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-screen bg-background pb-20 md:pb-0">
      {/* Enhanced Header with Quick Actions - Hide buttons on mobile, show simplified version */}
      <header className="border-b border-border bg-background sticky top-0 z-40">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">📷 PhotoLabel</h1>
              <p className="text-sm text-muted-foreground">
                {currentlyShowing} de {totalItems} arquivo{totalItems !== 1 ? 's' : ''} • {unlabeledPhotos.length} sem labels
              </p>
            </div>

            {/* Desktop Quick Actions - Hidden on mobile */}
            <div className="hidden md:flex items-center gap-2">
              {/* Quick Actions */}
              <Toggle 
                pressed={showUnlabeledFilter}
                onPressedChange={handleToggleUnlabeledFilter}
                className="gap-2"
                size="sm"
              >
                <TagIcon className="h-4 w-4" />
                Sem Labels ({unlabeledPhotos.length})
              </Toggle>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowUpload(true)}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                Upload
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowLabelCreator(true)}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Nova Label
              </Button>

              {hasActiveFilters && (
                <Button
                  onClick={() => setShowCreateAlbum(true)}
                  className="gap-2 bg-primary hover:bg-primary/90"
                >
                  <Archive className="h-4 w-4" />
                  Salvar como Coleção
                </Button>
              )}
            </div>
          </div>

          {/* View Controls - Desktop only */}
          <div className="hidden md:flex items-center justify-between mt-3">
            <div className="flex items-center gap-2">
              <Select value={itemsPerPage.toString()} onValueChange={(value) => changeItemsPerPage(parseInt(value))}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 por página</SelectItem>
                  <SelectItem value="60">60 por página</SelectItem>
                  <SelectItem value="100">100 por página</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Toggle 
                pressed={viewMode === 'grid'}
                onPressedChange={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                size="sm"
              >
                {viewMode === 'grid' ? <Grid3X3 className="h-4 w-4" /> : <List className="h-4 w-4" />}
              </Toggle>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Hub - Quick Access Cards */}
      <NavigationHub
        albumsCount={albums.length}
        unlabeledCount={unlabeledPhotos.length}
        clustersCount={3} // Placeholder for smart clusters
        onScrollToSection={(section) => {
          if (section === 'collections') {
            // Scroll to collections section or apply filters
            const collectionsElement = document.getElementById('collections-section');
            collectionsElement?.scrollIntoView({ behavior: 'smooth' });
          } else if (section === 'unlabeled') {
            handleToggleUnlabeledFilter();
          } else if (section === 'smart') {
            // Scroll to smart suggestions
            const smartElement = document.getElementById('smart-suggestions-section');
            smartElement?.scrollIntoView({ behavior: 'smooth' });
          }
        }}
      />

      {/* Quick Access Sections - Show when no active filters */}
      {!hasActiveFilters && (
        <div className="px-4 py-4 space-y-6">
          {/* Minhas Coleções Section */}
          <section id="collections-section" className="animate-fade-in">
            <div className="mb-4">
              <div className="flex items-center gap-3 mb-2">
                <FolderOpen className="h-6 w-6 text-primary" />
                <h2 className="text-xl font-bold text-foreground">Minhas Coleções</h2>
                <span className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded-full">
                  {albums.length}
                </span>
              </div>
              <p className="text-muted-foreground text-sm">
                Acesse suas coleções organizadas por temas
              </p>
            </div>

            {albums.length === 0 ? (
              <Card className="p-8 text-center bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                <div className="text-4xl mb-4 opacity-80">📁</div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Nenhuma coleção criada
                </h3>
                <p className="text-muted-foreground mb-4 text-sm">
                  Organize suas fotos em coleções temáticas
                </p>
                <Button onClick={() => setShowCreateAlbum(true)} size="sm" className="gap-2">
                  <FolderPlus className="h-4 w-4" />
                  Criar Coleção
                </Button>
              </Card>
            ) : (
              <HorizontalCarousel>
                {albums.map((album, index) => (
                  <div 
                    key={album.id} 
                    className="flex-shrink-0 animate-fade-in" 
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className="group cursor-pointer hover:scale-105 transition-transform duration-200">
                      <Card 
                        className="w-64 h-40 relative overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 border hover:border-primary/40"
                        onClick={() => handleAlbumClick(album)}
                      >
                        {album.cover_photo_url ? (
                          <div className="relative w-full h-full">
                            <img 
                              src={album.cover_photo_url} 
                              alt={album.name}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                            <div className="absolute bottom-3 left-3 right-3">
                              <h3 className="text-white font-bold text-sm drop-shadow-lg">
                                {album.name}
                              </h3>
                              <p className="text-white/80 text-xs drop-shadow">
                                {album.labels.length} label{album.labels.length !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-muted to-muted/50 text-center p-3">
                            <FolderOpen className="h-6 w-6 text-muted-foreground mb-2" />
                            <h3 className="font-semibold text-sm text-foreground">
                              {album.name}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                              {album.labels.length} label{album.labels.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                        )}
                        
                        {/* Action Buttons Overlay */}
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditAlbum(album);
                              }}
                              className="h-6 w-6 p-0"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteAlbum(album.id);
                              }}
                              className="h-6 w-6 p-0"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    </div>
                  </div>
                ))}
                
                {/* Create Collection Button */}
                <div className="flex-shrink-0">
                  <Card 
                    className="w-64 h-40 border-2 border-dashed border-primary/30 hover:border-primary/60 hover:scale-105 transition-all duration-200 cursor-pointer group shadow-md hover:shadow-lg"
                    onClick={() => setShowCreateAlbum(true)}
                  >
                    <div className="flex flex-col items-center justify-center h-full text-center p-3">
                      <FolderPlus className="h-6 w-6 text-primary group-hover:scale-110 transition-transform mb-2" />
                      <span className="text-sm font-medium text-foreground">Criar Coleção</span>
                      <span className="text-xs text-muted-foreground">Organize suas fotos</span>
                    </div>
                  </Card>
                </div>
              </HorizontalCarousel>
            )}
          </section>

          {/* Unlabeled Photos Section */}
          <UnlabeledPhotosSection
            photos={photos}
            onViewAll={handleToggleUnlabeledFilter}
          />

          {/* Smart Suggestions Section */}
          <div id="smart-suggestions-section">
            <SmartSuggestionsSection
            photos={photos}
            labels={labels}
            onClusterClick={(labelIds) => {
              labelIds.forEach(labelId => {
                if (!filters?.labels.includes(labelId)) {
                  toggleLabel?.(labelId);
                }
              });
            }}
            />
          </div>
        </div>
      )}

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <section className="border-b border-border bg-card/30">
          <div className="px-4 py-2">
            <Card className="p-2 bg-primary/5 border-primary/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    Filtros ativos:
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {filters?.labels?.length || 0} label{(filters?.labels?.length || 0) !== 1 ? 's' : ''} selecionada{(filters?.labels?.length || 0) !== 1 ? 's' : ''}
                    {showFavorites && ' + favoritos'}
                    {showUnlabeledFilter && ' + sem labels'}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {totalItems} arquivo{totalItems !== 1 ? 's' : ''} no resultado
                </span>
              </div>
            </Card>
          </div>
        </section>
      )}

      {/* Photos Grid */}
      <main className="flex-1">
        <PhotoGallery
          photos={paginatedPhotos}
          labels={labels}
          selectedPhotoIds={selectedPhotoIds}
          onPhotoClick={handlePhotoClick}
          onLabelManage={handleLabelManage}
          onSelectionToggle={handleSelectionToggle}
          onUpdateLabels={handleUpdateLabels}
        />
        
        {/* Load More Button */}
        {hasMoreItems && (
          <div className="flex justify-center py-8">
            <Button 
              onClick={loadMore} 
              variant="outline" 
              size="lg"
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Mostrar Mais Arquivos (+30)
            </Button>
          </div>
        )}
      </main>

      {/* Selection Panel */}
      <SelectionPanel
        selectedCount={selectedCount}
        onManageLabels={handleBulkLabelManage}
        onDeleteSelected={handleDeleteSelected}
        onClearSelection={clearSelection}
        onCreateCollection={() => setShowCreateAlbum(true)}
      />

      {/* Upload Dialog */}
      <UploadDialog
        isOpen={showUpload}
        onClose={() => setShowUpload(false)}
        onUpload={handleUploadFiles}
        labels={labels}
        onCreateLabel={createLabel}
        onApplyLabelsToPhotos={applyLabelsToPhotos}
      />

      {/* Dialogs */}
      <CreateAlbumDialog
        isOpen={showCreateAlbum}
        onClose={() => setShowCreateAlbum(false)}
        onCreateAlbum={handleCreateAlbumFromFilters}
        selectedLabels={filters?.labels || []}
        labels={labels}
        filteredPhotos={photosForAlbum}
      />

      <BulkLabelDialog
        isOpen={showBulkLabel}
        onClose={() => setShowBulkLabel(false)}
        onApplyLabels={handleApplyBulkLabels}
        onRemoveLabels={handleRemoveBulkLabels}
        selectedPhotos={getSelectedPhotos(photos)}
        labels={labels}
        onCreateLabel={handleCreateLabel}
      />

      <LabelManager
        isOpen={showLabelManager}
        onClose={() => {
          setShowLabelManager(false);
          setSelectedPhotoForLabels(null);
        }}
        labels={labels}
        selectedPhoto={selectedPhotoForLabels ? 
          photos.find(p => p.id === selectedPhotoForLabels) : 
          undefined
        }
        onCreateLabel={handleCreateLabel}
        onDeleteLabel={async (labelId: string) => {
          toast({
            title: "Funcionalidade em desenvolvimento",
            description: "A exclusão de labels será implementada em breve.",
          });
          return false;
        }}
        onUpdatePhotoLabels={async (photoId: string, labelIds: string[]) => {
          await updatePhotoLabels(photoId, labelIds);
          return true;
        }}
      />

      <StandardLabelCreator
        trigger={<></>}
        isOpen={showLabelCreator}
        onOpenChange={setShowLabelCreator}
        onCreateLabel={handleCreateLabel}
      />

      <PhotoModal
        photo={selectedPhotoForModal}
        labels={labels}
        isOpen={showPhotoModal}
        onClose={() => {
          setShowPhotoModal(false);
          setSelectedPhotoForModal(null);
        }}
        onLabelManage={() => {
          if (selectedPhotoForModal) {
            setSelectedPhotoForLabels(selectedPhotoForModal.id);
            setShowLabelManager(true);
          }
        }}
        onDelete={handleDeletePhoto}
      />

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav
        onUpload={() => setShowUpload(true)}
        onToggleSearch={() => setShowMobileSearch(true)}
        onToggleUnlabeled={handleToggleUnlabeledFilter}
        showUnlabeled={showUnlabeledFilter}
        unlabeledCount={unlabeledPhotos.length}
      />

      {/* Mobile Search Overlay */}
      <MobileSearchOverlay
        isOpen={showMobileSearch}
        onClose={() => setShowMobileSearch(false)}
        labels={labels}
        selectedLabels={filters?.labels || []}
        searchTerm={filters?.searchTerm}
        onSearchChange={updateSearchTerm}
        onLabelToggle={toggleLabel}
        onClearFilters={clearFilters}
      />
    </div>
  );
}