import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Save, Plus, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PhotoGallery } from '@/components/PhotoGallery';
import { SelectionPanel } from '@/components/SelectionPanel';
import { CreateAlbumDialog } from '@/components/CreateAlbumDialog';
import { BulkLabelDialog } from '@/components/BulkLabelDialog';
import { LabelManager } from '@/components/LabelManager';
import { StandardLabelCreator } from '@/components/StandardLabelCreator';
import { AppSidebar } from '@/components/AppSidebar';
import { AdvancedFilters } from '@/components/AdvancedFilters';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSupabaseData } from '@/hooks/useSupabaseData';
import { useAdvancedFilters } from '@/hooks/useAdvancedFilters';
import { usePhotoSelection } from '@/hooks/usePhotoSelection';

import { usePagination } from '@/hooks/usePagination';
import { useAlbums } from '@/hooks/useAlbums';
import { useToast } from '@/hooks/use-toast';
import { PhotoModal } from '@/components/PhotoModal';
import type { Photo, PhotoFilters } from '@/types/photo';

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
    applyLabelsToPhotos 
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

  // Use global filters if provided, otherwise use local filters
  const localFiltersHook = useAdvancedFilters(photos);
  
  const filters = props.filters || localFiltersHook.filters;
  const filteredPhotos = props.filteredPhotos || localFiltersHook.filteredPhotos;
  const showFavorites = props.showFavorites || localFiltersHook.showFavorites;
  const updateFilters = props.updateFilters || localFiltersHook.updateFilters;
  const updateSearchTerm = localFiltersHook.updateSearchTerm;
  const toggleLabel = props.toggleLabel || localFiltersHook.toggleLabel;
  const toggleFileType = props.toggleFileType || localFiltersHook.toggleFileType;
  const toggleMediaType = props.toggleMediaType || localFiltersHook.toggleMediaType;
  const toggleFavorites = props.toggleFavorites || localFiltersHook.toggleFavorites;
  const clearFilters = props.clearFilters || localFiltersHook.clearFilters;

  const {
    paginatedItems: paginatedPhotos,
    hasMoreItems,
    loadMore,
    changeItemsPerPage,
    itemsPerPage,
    currentlyShowing,
    totalItems
  } = usePagination(filteredPhotos, 30);

  const { createAlbum } = useAlbums();
  const { toast } = useToast();

  // Dialog states
  const [showCreateAlbum, setShowCreateAlbum] = useState(false);
  const [showBulkLabel, setShowBulkLabel] = useState(false);
  const [showLabelManager, setShowLabelManager] = useState(false);
  const [showLabelCreator, setShowLabelCreator] = useState(false);
  const [selectedPhotoForLabels, setSelectedPhotoForLabels] = useState<string | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPhotoForModal, setSelectedPhotoForModal] = useState<any | null>(null);

  // Check for recent filter parameter
  useEffect(() => {
    const filterParam = searchParams.get('filter');
    if (filterParam === 'recent') {
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
  const hasActiveFilters = filters.labels.length > 0 || filters.searchTerm;

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
    console.log('handleUpdateLabels called with:', photoId, labelIds);
    const result = await updatePhotoLabels(photoId, labelIds);
    console.log('updatePhotoLabels result:', result);
    
    // Force refresh of photos to update the UI immediately
    if (result) {
      console.log('Refreshing photos data...');
      // The useSupabaseData hook should automatically refresh photos after update
    }
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
    <div className="flex-1 min-h-screen bg-background">
      {/* Header */}
        <header className="border-b border-border bg-background sticky top-0 z-40">
          <div className="px-4 py-2">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Explorar Biblioteca</h1>
                <p className="text-sm text-muted-foreground">
                  {currentlyShowing} de {totalItems} arquivo{totalItems !== 1 ? 's' : ''} exibido{totalItems !== 1 ? 's' : ''}
                </p>
              </div>

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
          </div>
        </header>

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
                      {filters.labels.length} label{filters.labels.length !== 1 ? 's' : ''} selecionada{filters.labels.length !== 1 ? 's' : ''}
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

      {/* Dialogs */}
      <CreateAlbumDialog
        isOpen={showCreateAlbum}
        onClose={() => setShowCreateAlbum(false)}
        onCreateAlbum={handleCreateAlbumFromFilters}
        selectedLabels={filters.labels}
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
          // Implementation for deleting label
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
    </div>
  );
}