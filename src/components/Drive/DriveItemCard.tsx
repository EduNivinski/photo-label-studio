import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import { DriveThumbOptimized } from '@/components/DriveThumbOptimized';

interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink?: string;
  webViewLink?: string;
  source: 'gdrive';
  item_key: string;
}

interface DriveItemCardProps {
  item: DriveItem;
  signedThumbnailUrl?: string;
  onClick: () => void;
  onRecoverThumbnail?: (fileId: string) => Promise<void>;
}

export function DriveItemCard({ item, signedThumbnailUrl, onClick, onRecoverThumbnail }: DriveItemCardProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const isImage = item.mimeType?.startsWith('image/');
  const isVideo = item.mimeType?.startsWith('video/');
  const isFolder = item.mimeType === 'application/vnd.google-apps.folder';
  
  const thumbnailSrc = signedThumbnailUrl || item.thumbnailLink;

  const handleImageError = async (e: React.SyntheticEvent<HTMLImageElement>) => {
    // Captura referência síncrona do elemento
    const imgEl = e.currentTarget as HTMLImageElement;
    
    // Limite de tentativas por elemento
    const retries = Number(imgEl.dataset.retries || "0");
    if (retries >= 1) {
      // Já tentamos renovar uma vez: fixa no placeholder
      imgEl.src = "/img/placeholder.png";
      setImageError(true);
      return;
    }
    imgEl.dataset.retries = String(retries + 1);

    // Coloca placeholder imediato para quebrar loop visual
    imgEl.src = "/img/placeholder.png";
    setImageError(true);

    // Dispara renovação se disponível
    if (onRecoverThumbnail) {
      try {
        await onRecoverThumbnail(item.item_key);
        // Verifica se elemento ainda está no DOM
        if (!imgEl.isConnected) return;
        
        const fresh = signedThumbnailUrl || item.thumbnailLink;
        if (fresh) {
          // Cache-buster para evitar 401/404 em cache
          imgEl.src = `${fresh}&v=${Date.now()}`;
          setImageError(false);
        }
      } catch (error) {
        console.warn('Failed to recover thumbnail:', error);
        // Mantém placeholder em caso de falha
      }
    }
  };

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  return (
    <Card 
      className="group overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-300"
      onClick={onClick}
    >
      <div className="aspect-square relative bg-muted">
        {isFolder ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-4xl">📁</div>
          </div>
        ) : (thumbnailSrc && !imageError) || item.mimeType?.startsWith('image/') ? (
          <>
            <DriveThumbOptimized 
              fileId={item.item_key} 
              name={item.name}
              className={`w-full h-full object-cover transition-all duration-500 ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              } group-hover:scale-110`}
            />
            {!imageLoaded && (
              <div className="absolute inset-0 bg-muted animate-pulse" />
            )}
            {isVideo && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-black/70 rounded-full p-3 backdrop-blur-sm">
                  <svg className="w-6 h-6 text-white fill-white" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <div className="text-3xl mb-2">
                {isImage ? '🖼️' : isVideo ? '🎥' : '📄'}
              </div>
              <div className="text-xs text-muted-foreground">
                {item.mimeType}
              </div>
            </div>
          </div>
        )}

        {/* Action buttons overlay */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-1">
          {item.webViewLink && (
            <Button
              size="sm"
              variant="secondary"
              className="h-8 w-8 p-0 bg-white/90 hover:bg-white backdrop-blur-sm"
              onClick={(e) => {
                e.stopPropagation();
                window.open(item.webViewLink, '_blank');
              }}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      
      {/* File name and Drive link */}
      <div className="p-3">
        <h3 className="text-sm font-medium truncate mb-2" title={item.name}>
          {item.name}
        </h3>
        <a
          href={item.webViewLink || `https://drive.google.com/file/d/${item.item_key}/view`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="h-3 w-3" />
          Abrir no Drive
        </a>
      </div>
    </Card>
  );
}