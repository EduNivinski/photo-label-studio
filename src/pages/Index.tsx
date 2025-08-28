import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Upload, Library, FolderOpen, FolderPlus, Edit, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AppSidebar } from '@/components/AppSidebar';
import { HorizontalCarousel } from '@/components/HorizontalCarousel';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useSupabaseData } from '@/hooks/useSupabaseData';
import { usePhotoFilters } from '@/hooks/usePhotoFilters';
import { usePhotoSelection } from '@/hooks/usePhotoSelection';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useAlbums } from '@/hooks/useAlbums';
import { SearchBar } from '@/components/SearchBar';
import { RelatedLabelsBar } from '@/components/RelatedLabelsBar';
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
    clearFilters,
    includedLabels,
    excludedLabels,
    includeLabel,
    excludeLabel,
    removeLabel,
    getRelatedLabels
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
    const confirmed = confirm('Tem certeza que deseja deletar esta coleção?');
    if (confirmed) {
      const success = await deleteAlbum(albumId);
      if (success) {
        toast.success('Coleção deletada com sucesso!');
      } else {
        toast.error('Erro ao deletar coleção');
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
  const hasActiveFilters = filters.labels.length > 0 || filters.showUnlabeled || filters.searchTerm.trim() !== '' || 
    includedLabels.length > 0 || excludedLabels.length > 0;

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
      {/* Header */}
        {(currentView === 'gallery' || hasActiveFilters) && (
          <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
            <div className="px-4 py-2">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-foreground">Galeria de Fotos</h1>
                  <p className="text-sm text-muted-foreground">
                    {filteredPhotos.length} foto{filteredPhotos.length !== 1 ? 's' : ''} encontrada{filteredPhotos.length !== 1 ? 's' : ''}
                  </p>
                </div>
                
                <Button 
                  onClick={handleBackToHome}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  Voltar à Home
                </Button>
              </div>
            </div>
          </header>
        )}

        {/* Content */}
        {currentView === 'home' && !hasActiveFilters ? (
          <div className="flex-1 overflow-y-auto">
            {/* Hero Section */}
            <section className="px-4 py-3 bg-gradient-to-br from-primary/5 to-background border-b border-border">
              <div className="text-center max-w-2xl mx-auto">
                <h1 className="text-3xl font-bold text-foreground mb-2">📷 PhotoLabel</h1>
                <p className="text-muted-foreground mb-4">
                  Organize suas fotos com labels inteligentes e crie coleções memoráveis
                </p>
                <div className="flex gap-3 justify-center">
                  <Link to="/library">
                    <Button size="lg" className="gap-2 px-6 shadow-lg hover:shadow-xl transition-all">
                      <Library className="h-5 w-5" />
                      Explorar Biblioteca
                    </Button>
                  </Link>
                  <Button 
                    onClick={handleUpload}
                    size="lg"
                    variant="outline"
                    className="gap-2 px-6 shadow-lg hover:shadow-xl transition-all"
                  >
                    <Upload className="h-5 w-5" />
                    Upload
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Adicione novas fotos e vídeos facilmente
                </p>
              </div>
            </section>

            {/* My Collections Section - Renamed from Albums */}
            <section className="px-4 py-3 border-b border-border animate-fade-in">
              <div className="mb-4">
                <div className="flex items-center gap-3 mb-2">
                  <FolderOpen className="h-6 w-6 text-primary" />
                  <h2 className="text-xl font-bold text-foreground">Minhas Coleções</h2>
                  <span className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded-full">
                    {albums.length}
                  </span>
                </div>
                <p className="text-muted-foreground text-sm">
                  Agrupe suas memórias em coleções temáticas
                </p>
              </div>

              {albums.length === 0 ? (
                <Card className="p-12 text-center bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                  <div className="text-7xl mb-6 opacity-80">📁</div>
                  <h3 className="text-xl font-semibold text-foreground mb-3">
                    Nenhuma coleção criada
                  </h3>
                  <p className="text-muted-foreground mb-6 text-base">
                    Comece criando coleções para organizar melhor suas memórias
                  </p>
                  <Button onClick={handleCreateAlbum} size="lg" className="gap-2 px-8 py-3 text-base shadow-lg hover:shadow-xl transition-all">
                    <FolderPlus className="h-5 w-5" />
                    Criar primeira coleção
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
                          className="w-64 h-48 relative overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 border hover:border-primary/40"
                          onClick={() => handleAlbumClick(album)}
                        >
                          {/* Cover Photo with Overlay */}
                          {album.cover_photo_url ? (
                            <div className="relative w-full h-full">
                              <img 
                                src={album.cover_photo_url} 
                                alt={album.name}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                              <div className="absolute bottom-4 left-4 right-4">
                                <h3 className="text-white font-bold text-lg drop-shadow-lg">
                                  {album.name}
                                </h3>
                                <p className="text-white/80 text-sm drop-shadow">
                                  {album.labels.length} label{album.labels.length !== 1 ? 's' : ''}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-muted to-muted/50 text-center p-4">
                              <FolderOpen className="h-8 w-8 text-muted-foreground mb-2" />
                              <h3 className="font-semibold text-foreground">
                                {album.name}
                              </h3>
                              <p className="text-sm text-muted-foreground">
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
                                className="h-8 w-8 p-0"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteAlbum(album.id);
                                }}
                                className="h-8 w-8 p-0"
                              >
                                <Trash2 className="h-4 w-4" />
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
                      className="w-64 h-48 border-2 border-dashed border-primary/30 hover:border-primary/60 hover:scale-105 transition-all duration-200 cursor-pointer group shadow-md hover:shadow-lg"
                      onClick={handleCreateAlbum}
                    >
                      <div className="flex flex-col items-center justify-center h-full text-center p-4">
                        <FolderPlus className="h-8 w-8 text-primary group-hover:scale-110 transition-transform mb-2" />
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
                onIncludeLabel={includeLabel}
              />
            )}

            {/* Related Labels Bar - Advanced Filtering - Always show when there are filters */}
            <RelatedLabelsBar
              relatedLabels={getRelatedLabels}
              allLabels={labels}
              includedLabels={includedLabels}
              excludedLabels={excludedLabels}
              onIncludeLabel={includeLabel}
              onExcludeLabel={excludeLabel}
              onRemoveLabel={removeLabel}
            />

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