import { useState } from 'react';
import { SearchBar } from '@/components/SearchBar';
import { LabelFilter } from '@/components/LabelFilter';
import { PhotoGallery } from '@/components/PhotoGallery';
import { PhotoModal } from '@/components/PhotoModal';
import { usePhotoFilters } from '@/hooks/usePhotoFilters';
import { mockPhotos, mockLabels } from '@/data/mockData';
import { useToast } from '@/hooks/use-toast';
import type { Photo } from '@/types/photo';

const Index = () => {
  const { toast } = useToast();
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const {
    filters,
    filteredPhotos,
    updateSearchTerm,
    toggleLabel
  } = usePhotoFilters(mockPhotos);

  const handlePhotoClick = (photo: Photo) => {
    setSelectedPhoto(photo);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedPhoto(null);
  };

  const handleUpload = () => {
    toast({
      title: "Upload",
      description: "Funcionalidade de upload será implementada com Supabase",
    });
  };

  const handleLabelManage = () => {
    toast({
      title: "Gerenciar Labels",
      description: "Funcionalidade de gerenciamento de labels será implementada",
    });
  };

  const handlePhotoDelete = () => {
    toast({
      title: "Excluir Foto",
      description: "Funcionalidade de exclusão será implementada com Supabase",
    });
  };

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
      />

      {/* Filters */}
      <LabelFilter
        labels={mockLabels}
        selectedLabels={filters.labels}
        onLabelToggle={toggleLabel}
      />

      {/* Gallery */}
      <PhotoGallery
        photos={filteredPhotos}
        labels={mockLabels}
        onPhotoClick={handlePhotoClick}
        onLabelManage={handleLabelManage}
      />

      {/* Modal */}
      <PhotoModal
        photo={selectedPhoto}
        labels={mockLabels}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onLabelManage={handleLabelManage}
        onDelete={handlePhotoDelete}
      />
    </div>
  );
};

export default Index;
