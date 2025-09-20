import { useState, useEffect } from "react";
import { Play, ExternalLink } from "lucide-react";
import { useGDriveThumbs } from "@/hooks/useGDriveThumbs";
import { requestVideoUrls } from "@/hooks/useSignedVideos";
import { formatDuration } from "@/lib/formatDuration";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,  
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";

interface VideoMetadata {
  durationMs?: number | null;
  width?: number | null;
  height?: number | null;
}

interface DriveVideoItem {
  id: string;
  item_key: string;
  name: string;
  mime_type: string;
  web_view_link?: string;
  video?: VideoMetadata;
  source: 'gdrive';
}

interface CardVideoGDriveProps {
  item: DriveVideoItem;
  posterSrc?: string;
  onPlay?: (item: DriveVideoItem) => void;
  onRecoverThumbnail?: (fileId: string) => void;
}

export default function CardVideoGDrive({ 
  item, 
  posterSrc, 
  onPlay,
  onRecoverThumbnail 
}: CardVideoGDriveProps) {
  const [videoSrc, setVideoSrc] = useState<string>("");
  const [isHovered, setIsHovered] = useState(false);
  
  const duration = formatDuration(item.video?.durationMs);
  
  // Load video URL on hover or click
  const loadVideoSrc = async () => {
    if (videoSrc) return;
    
    try {
      const videoUrls = await requestVideoUrls([item.item_key]);
      const url = videoUrls[item.item_key];
      if (url) {
        setVideoSrc(url);
      }
    } catch (error) {
      console.error('Failed to load video URL:', error);
    }
  };
  
  const handleCardClick = () => {
    loadVideoSrc();
    if (onPlay) {
      onPlay(item);
    }
  };

  const handleOpenInDrive = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.web_view_link) {
      window.open(item.web_view_link, '_blank', 'noopener,noreferrer');
    }
  };

  const handleImageError = () => {
    if (onRecoverThumbnail) {
      onRecoverThumbnail(item.item_key);
    }
  };

  return (
    <div 
      className="group relative rounded-lg border bg-card overflow-hidden cursor-pointer hover:shadow-md transition-all duration-200"
      onMouseEnter={() => {
        setIsHovered(true);
        loadVideoSrc();
      }}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Video or Poster */}
      <div className="relative aspect-video bg-muted">
        {videoSrc ? (
          <video
            controls
            preload="metadata"
            poster={posterSrc}
            src={videoSrc}
            className="w-full h-full object-cover"
            onClick={(e) => e.stopPropagation()}
          />
        ) : posterSrc ? (
          <img
            src={posterSrc}
            alt={item.name}
            className="w-full h-full object-cover"
            onError={handleImageError}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Play className="w-8 h-8 text-muted-foreground" />
          </div>
        )}
        
        {/* Play overlay - only show if no video src loaded */}
        {!videoSrc && (
          <div 
            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20"
            onClick={handleCardClick}
          >
            <div className="rounded-full bg-black/60 p-3">
              <Play className="w-6 h-6 text-white fill-white" />
            </div>
          </div>
        )}
        
        {/* Duration badge */}
        {duration && duration !== "00:00" && (
          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/70 text-white text-xs rounded">
            {duration}
          </div>
        )}
        
        {/* Menu */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 bg-black/50 hover:bg-black/70 text-white"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleOpenInDrive}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Abrir no Drive
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {/* Bottom info */}
      <div className="p-2">
        <div className="text-sm font-medium truncate" title={item.name}>
          {item.name}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          Vídeo • Google Drive
        </div>
      </div>
    </div>
  );
}