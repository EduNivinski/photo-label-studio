import { useMemo } from 'react';
import { DriveItemCard } from './DriveItemCard';
import CardVideoGDrive from '../library/CardVideoGDrive';
import { useGDriveThumbs } from '@/hooks/useGDriveThumbs';

interface DriveItem {
  id: string;
  name: string;
  mime_type: string;
  web_view_link?: string;
  source: 'gdrive';
  item_key: string;
  video?: {
    durationMs?: number | null;
    width?: number | null;
    height?: number | null;
  };
}

interface DriveItemCardItem {
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
  // Extract file IDs for Drive items that need signed URLs (images and videos)
  const driveFileIds = useMemo(() => {
    return items
      .filter(item => 
        item.source === 'gdrive' && 
        item.item_key &&
        (item.mime_type?.startsWith('image/') || item.mime_type?.startsWith('video/'))
      )
      .map(item => item.item_key);
  }, [items]);

  // Get signed thumbnail URLs
  const { urlFor, loading, recoverOne } = useGDriveThumbs(driveFileIds);

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
      {loading && (
        <div className="mb-4 text-sm text-muted-foreground">
          Carregando thumbnails...
        </div>
      )}
      
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
        {items.map((item) => {
          const isVideo = item.mime_type?.startsWith('video/');
          const isImage = item.mime_type?.startsWith('image/');
          
          if (isVideo) {
            return (
              <CardVideoGDrive
                key={item.id}
                item={{
                  ...item,
                  item_key: item.item_key,
                  source: 'gdrive' as const
                }}
                posterSrc={urlFor(item.item_key)}
                onRecoverThumbnail={recoverOne}
                onPlay={(videoItem) => {
                  // Por enquanto, abre direto no Drive
                  if (videoItem.web_view_link) {
                    window.open(videoItem.web_view_link, '_blank', 'noopener,noreferrer');
                  }
                }}
              />
            );
          }
          
          return (
            <DriveItemCard
              key={item.id}
              item={{
                ...item,
                mimeType: item.mime_type
              } as DriveItemCardItem}
              signedThumbnailUrl={isImage || isVideo ? urlFor(item.item_key) : undefined}
              onClick={() => onItemClick(item)}
              onRecoverThumbnail={recoverOne}
            />
          );
        })}
      </div>
    </div>
  );
}