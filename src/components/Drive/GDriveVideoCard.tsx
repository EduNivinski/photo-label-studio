import { Play } from "lucide-react";
import GDriveThumb from "@/components/GDriveThumb";
import VideoBadge from "@/components/VideoBadge";

interface VideoMetadata {
  durationMs?: number | null;
  width?: number | null;
  height?: number | null;
}

interface DriveVideoItem {
  item_key: string;
  name: string;
  web_view_link?: string;
  video?: VideoMetadata;
}

interface GDriveVideoCardProps {
  item: DriveVideoItem;
  onClick?: (item: DriveVideoItem) => void;
}

export default function GDriveVideoCard({ item, onClick }: GDriveVideoCardProps) {
  const handleClick = () => {
    if (onClick) {
      onClick(item);
    }
  };

  return (
    <div 
      className="relative group rounded-lg border overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
      onClick={handleClick}
    >
      {/* Poster */}
      <div className="relative">
        <GDriveThumb 
          fileId={item.item_key} 
          name={item.name} 
          className="h-40 w-full object-cover bg-muted" 
        />
        
        {/* Play overlay */}
        <div className="pointer-events-none absolute inset-0 grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="rounded-full bg-black/60 p-3">
            <Play className="w-6 h-6 text-white fill-white" />
          </div>
        </div>
        
        {/* Duration badge */}
        <VideoBadge ms={item.video?.durationMs ?? null} />
      </div>
      
      {/* Bottom bar */}
      <div className="flex items-center justify-between p-2">
        <div className="truncate text-sm font-medium" title={item.name}>
          {item.name}
        </div>
        <a
          href={item.web_view_link || `https://drive.google.com/file/d/${item.item_key}/view`}
          target="_blank" 
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline ml-2 flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          Abrir no Drive
        </a>
      </div>
    </div>
  );
}