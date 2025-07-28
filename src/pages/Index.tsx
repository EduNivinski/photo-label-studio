import { useState } from 'react';
import { SearchBar } from '@/components/SearchBar';
import { PhotoGallery } from '@/components/PhotoGallery';
import { PhotoModal } from '@/components/PhotoModal';
import { LabelManager } from '@/components/LabelManager';
import { UploadDialog } from '@/components/UploadDialog';
import { usePhotoFilters } from '@/hooks/usePhotoFilters';
import { useSupabaseData } from '@/hooks/useSupabaseData';
import { useToast } from '@/hooks/use-toast';
import type { Photo } from '@/types/photo';

const Index = () => {
  const { toast } = useToast();
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isLabelManagerOpen, setIsLabelManagerOpen] = useState(false);
  
  const {
    photos,
    labels,
    loading,
    createLabel,
    deleteLabel,
    updatePhotoLabels,
    deletePhoto,
    uploadPhotos
  } = useSupabaseData();

  const {
    filters,
    filteredPhotos,
    filterMode,
    updateSearchTerm,
    toggleLabel,
    toggleUnlabeled,
    clearFilters,
    setFilterMode
  } = usePhotoFilters(photos);

  const handlePhotoClick = (photo: Photo) => {
    setSelectedPhoto(photo);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedPhoto(null);
  };

  const handleUpload = () => {
    setIsUploadOpen(true);
  };

  const handleUploadFiles = async (files: File[]) => {
    await uploadPhotos(files);
  };

  const handleLabelManage = (photo?: Photo) => {
    if (photo) {
      setSelectedPhoto(photo);
    }
    setIsLabelManagerOpen(true);
  };

  const handlePhotoDelete = async () => {
    if (!selectedPhoto) return;
    
    const success = await deletePhoto(selectedPhoto.id);
    if (success) {
      toast({
        title: "Foto excluída",
        description: "Foto removida com sucesso!",
      });
      handleModalClose();
    } else {
      toast({
        title: "Erro",
        description: "Falha ao excluir foto.",
        variant: "destructive"
      });
    }
  };

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
          <h1 className="text-2xl font-bold text-foreground">PhotoLabel</h1>
          <p className="text-sm text-muted-foreground">
            Organize suas fotos com labels inteligentes
          </p>
        </div>
      </header>

      {/* Search */}
      <SearchBar
        searchTerm={filters.searchTerm}
        onSearchChange={updateSearchTerm}
        onUpload={handleUpload}
        labels={labels}
        selectedLabels={filters.labels}
        filterMode={filterMode}
        showUnlabeled={filters.showUnlabeled}
        onLabelToggle={toggleLabel}
        onFilterModeChange={setFilterMode}
        onToggleUnlabeled={toggleUnlabeled}
        onClearFilters={clearFilters}
        onManageLabels={() => handleLabelManage()}
      />

      {/* Gallery */}
      <PhotoGallery
        photos={filteredPhotos}
        labels={labels}
        onPhotoClick={handlePhotoClick}
        onLabelManage={handleLabelManage}
      />

      {/* Upload Dialog */}
      <UploadDialog
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUpload={handleUploadFiles}
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

      {/* Photo Modal */}
      <PhotoModal
        photo={selectedPhoto}
        labels={labels}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onLabelManage={() => handleLabelManage(selectedPhoto || undefined)}
        onDelete={handlePhotoDelete}
      />
    </div>
  );
};

export default Index;
