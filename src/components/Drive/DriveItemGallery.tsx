import { useEffect, useMemo } from 'react';
import { DriveItemCard } from './DriveItemCard';
import { useSignedThumbnails } from '@/hooks/useSignedThumbnails';

interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink?: string;
  webViewLink?: string;
  source: 'gdrive';
  item_key: string;
}

interface DriveItemGalleryProps {
  items: DriveItem[];
  onItemClick: (item: DriveItem) => void;
}

export function DriveItemGallery({ items, onItemClick }: DriveItemGalleryProps) {
  // Extract file IDs for Drive items that need signed URLs
  const driveFileIds = useMemo(() => {
    return items
      .filter(item => item.source === 'gdrive' && item.item_key)
      .map(item => item.item_key);
  }, [items]);

  // Get signed thumbnail URLs
  const { thumbnailUrls, isLoading, error } = useSignedThumbnails(driveFileIds);

  if (items.length === 0) {
    return (
      <div className="w-full min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">📁</div>
          <h3 className="text-lg font-medium text-foreground mb-2">
            Nenhum arquivo encontrado
          </h3>
          <p className="text-muted-foreground">
            Nenhum arquivo foi encontrado nesta pasta
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Loading state for thumbnails */}
      {isLoading && (
        <div className="mb-4 text-sm text-muted-foreground">
          Carregando thumbnails...
        </div>
      )}
      
      {/* Error state for thumbnails */}
      {error && (
        <div className="mb-4 text-sm text-red-600">
          Erro ao carregar thumbnails: {error}
        </div>
      )}
      
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
        {items.map((item) => (
          <DriveItemCard
            key={item.id}
            item={item}
            signedThumbnailUrl={thumbnailUrls[item.item_key]}
            onClick={() => onItemClick(item)}
          />
        ))}
      </div>
    </div>
  );
}