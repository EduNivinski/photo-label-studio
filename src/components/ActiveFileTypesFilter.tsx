import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { useMemo } from 'react';
import type { Photo } from '@/types/photo';

interface ActiveFileTypesFilterProps {
  photos: Photo[];
  onToggleFileType: (fileType: string) => void;
  activeFileTypes: string[];
}

export function ActiveFileTypesFilter({ photos, onToggleFileType, activeFileTypes }: ActiveFileTypesFilterProps) {
  // Get unique file types from currently filtered photos
  const availableFileTypes = useMemo(() => {
    const fileTypes = new Set<string>();
    photos.forEach(photo => {
      // Extract file extension from photo name
      const extension = photo.name.split('.').pop()?.toLowerCase();
      if (extension) {
        fileTypes.add(extension.toUpperCase());
      }
    });
    return Array.from(fileTypes).sort();
  }, [photos]);

  // Only show file types that are both available and active
  const visibleFileTypes = availableFileTypes.filter(type => 
    activeFileTypes.includes(type)
  );

  if (visibleFileTypes.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {visibleFileTypes.map(fileType => (
        <Badge
          key={fileType}
          variant="secondary"
          className="cursor-pointer hover:bg-secondary/80 flex items-center gap-1"
          onClick={() => onToggleFileType(fileType)}
        >
          {fileType}
          <X size={12} className="hover:text-destructive" />
        </Badge>
      ))}
    </div>
  );
}