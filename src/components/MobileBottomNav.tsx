import { useState } from 'react';
import { Upload, Search, TagIcon, Eye, Grid3X3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MobileBottomNavProps {
  onUpload: () => void;
  onToggleSearch: () => void;
  onToggleUnlabeled: () => void;
  showUnlabeled: boolean;
  unlabeledCount: number;
  className?: string;
}

export function MobileBottomNav({
  onUpload,
  onToggleSearch,
  onToggleUnlabeled,
  showUnlabeled,
  unlabeledCount,
  className
}: MobileBottomNavProps) {
  return (
    <div className={cn(
      "fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t border-border p-2",
      "md:hidden", // Only show on mobile
      className
    )}>
      <div className="flex items-center justify-around max-w-sm mx-auto">
        {/* Upload Button */}
        <Button
          onClick={onUpload}
          variant="ghost"
          size="sm"
          className="flex flex-col gap-1 h-auto py-2 px-3"
        >
          <Upload className="h-5 w-5" />
          <span className="text-xs">Upload</span>
        </Button>

        {/* Search Toggle */}
        <Button
          onClick={onToggleSearch}
          variant="ghost"
          size="sm"
          className="flex flex-col gap-1 h-auto py-2 px-3"
        >
          <Search className="h-5 w-5" />
          <span className="text-xs">Buscar</span>
        </Button>

        {/* Unlabeled Filter */}
        <Button
          onClick={onToggleUnlabeled}
          variant={showUnlabeled ? "default" : "ghost"}
          size="sm"
          className="flex flex-col gap-1 h-auto py-2 px-3 relative"
        >
          <TagIcon className="h-5 w-5" />
          <span className="text-xs">Sem Labels</span>
          {unlabeledCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
              {unlabeledCount > 99 ? '99+' : unlabeledCount}
            </span>
          )}
        </Button>

        {/* View Toggle - can be expanded for grid/list mode */}
        <Button
          variant="ghost"
          size="sm"
          className="flex flex-col gap-1 h-auto py-2 px-3"
          disabled
        >
          <Grid3X3 className="h-5 w-5" />
          <span className="text-xs">Galeria</span>
        </Button>
      </div>
    </div>
  );
}