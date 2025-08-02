import { PhotoCard } from './PhotoCard';
import type { Photo, Label } from '@/types/photo';

interface PhotoGalleryProps {
  photos: Photo[];
  labels: Label[];
  selectedPhotoIds: Set<string>;
  onPhotoClick: (photo: Photo) => void;
  onLabelManage: (photo: Photo) => void;
  onSelectionToggle: (photoId: string, isShiftPressed: boolean) => void;
  onUpdateLabels: (photoId: string, labelIds: string[]) => void;
}

export function PhotoGallery({ 
  photos, 
  labels, 
  selectedPhotoIds,
  onPhotoClick, 
  onLabelManage,
  onSelectionToggle,
  onUpdateLabels
}: PhotoGalleryProps) {
  if (photos.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gallery-background">
        <div className="text-center">
          <div className="text-4xl mb-4">📷</div>
          <h3 className="text-lg font-medium text-foreground mb-2">
            Nenhum arquivo encontrado
          </h3>
          <p className="text-muted-foreground">
            Tente ajustar os filtros ou faça upload de novos arquivos
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 bg-gallery-background">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {photos.map((photo) => (
          <PhotoCard
            key={photo.id}
            photo={photo}
            labels={labels}
            isSelected={selectedPhotoIds.has(photo.id)}
            onClick={() => onPhotoClick(photo)}
            onLabelManage={() => onLabelManage(photo)}
            onSelectionToggle={(isShiftPressed) => onSelectionToggle(photo.id, isShiftPressed)}
            onUpdateLabels={onUpdateLabels}
          />
        ))}
      </div>
    </div>
  );
}