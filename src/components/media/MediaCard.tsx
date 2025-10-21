import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, Heart, MoreVertical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { MediaItem } from '@/types/media';
import { formatDuration } from '@/lib/formatDuration';
import { LabelChip } from '@/components/LabelChip';
import { useSignedVideos } from '@/hooks/useSignedVideos';
import { MediaThumb } from '@/components/MediaThumb';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface MediaCardProps {
  item: MediaItem;
  isSelected?: boolean;
  onClick?: () => void;
  onToggleSelection?: () => void;
  onToggleFavorite?: () => void;
  onAddLabel?: (labelName: string) => void;
  onRemoveLabel?: (labelId: string) => void;
  className?: string;
}

export function MediaCard({
  item,
  isSelected = false,
  onClick,
  onToggleSelection,
  onToggleFavorite,
  onAddLabel,
  onRemoveLabel,
  className = ''
}: MediaCardProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const { loadVideos, getVideoUrl } = useSignedVideos();

  const handleCardClick = () => {
    if (onToggleSelection) {
      onToggleSelection();
    } else if (onClick) {
      onClick();
    }
  };

  const handleImageError = () => {
    setImageError(true);
  };

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  const handlePlayVideo = async () => {
    if (item.isVideo && item.source === 'gdrive') {
      const fileId = item.id.replace('gdrive:', '');
      await loadVideos([fileId]);
      const videoSrc = getVideoUrl(fileId);
      if (videoSrc) {
        window.open(videoSrc, '_blank');
      }
    }
    if (onClick) onClick();
  };

  const handleOpenInDrive = () => {
    if (item.openInDriveUrl) {
      window.open(item.openInDriveUrl, '_blank');
    }
  };

  return (
    <Card 
      className={`group overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-300 ${
        isSelected ? 'ring-2 ring-primary shadow-lg' : ''
      } ${className}`}
      onClick={handleCardClick}
    >
      <div className="aspect-square relative bg-muted">
        {/* Selection checkbox */}
        {onToggleSelection && (
          <div className="absolute top-2 left-2 z-10">
            <div className={`w-5 h-5 rounded border-2 bg-background/80 backdrop-blur-sm transition-all ${
              isSelected ? 'bg-primary border-primary' : 'border-white/60'
            }`}>
              {isSelected && (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-sm" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Media content */}
        <MediaThumb 
          item={item}
          className="w-full h-full object-cover group-hover:scale-110 transition-all duration-500"
          onLoad={handleImageLoad}
          onError={handleImageError}
        />
        
        {item.isVideo && (
          <>
            {/* Play button overlay */}
            <div 
              className="absolute inset-0 flex items-center justify-center pointer-events-none group-hover:pointer-events-auto cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                handlePlayVideo();
              }}
            >
              <div className="bg-black/70 rounded-full p-3 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                <svg className="w-6 h-6 text-white fill-white" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </div>
            </div>
            {/* Duration badge */}
            {item.durationMs && (
              <Badge 
                variant="secondary" 
                className="absolute bottom-2 right-2 bg-black/70 text-white backdrop-blur-sm"
              >
                {formatDuration(Math.floor(item.durationMs / 1000))}
              </Badge>
            )}
          </>
        )}

        {/* Action buttons overlay */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-1">
          {/* Open in Drive button */}
          {item.source === 'gdrive' && item.openInDriveUrl && (
            <Button
              size="sm"
              variant="secondary"
              className="h-8 w-8 p-0 bg-white/90 hover:bg-white backdrop-blur-sm"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenInDrive();
              }}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}
          
          {/* Favorite button */}
          {onToggleFavorite && (
            <Button
              size="sm"
              variant="secondary"
              className="h-8 w-8 p-0 bg-white/90 hover:bg-white backdrop-blur-sm"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite();
              }}
            >
              <Heart className="h-4 w-4" />
            </Button>
          )}

          {/* More actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="secondary"
                className="h-8 w-8 p-0 bg-white/90 hover:bg-white backdrop-blur-sm"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {item.source === 'gdrive' && item.openInDriveUrl && (
                <DropdownMenuItem onClick={handleOpenInDrive}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Abrir no Drive
                </DropdownMenuItem>
              )}
              {item.downloadEnabled && (
                <DropdownMenuItem>
                  Download
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Gradient overlay for labels */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent h-20 pointer-events-none" />
        
        {/* Labels */}
        <div className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-1">
          {item.labels.slice(0, 3).map((label) => (
            <LabelChip
              key={label.id}
              label={label}
              variant="card"
              size="sm"
              onRemove={onRemoveLabel ? () => onRemoveLabel(label.id) : undefined}
            />
          ))}
          {item.labels.length > 3 && (
            <Badge variant="secondary" className="text-xs bg-white/20 text-white">
              +{item.labels.length - 3}
            </Badge>
          )}
        </div>
      </div>
      
      {/* File name */}
      <div className="p-3">
        <h3 className="text-sm font-medium truncate" title={item.name}>
          {item.name}
        </h3>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-muted-foreground">
            {item.source === 'gdrive' ? 'Google Drive' : 'Biblioteca'}
          </span>
          {item.source === 'gdrive' && (
            <span className="text-xs text-muted-foreground">
              Drive
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}