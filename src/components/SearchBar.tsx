import { Search, Upload, Settings } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SmartLabelSearch } from './SmartLabelSearch';
import type { Label } from '@/types/photo';

interface SearchBarProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onUpload: () => void;
  labels: Label[];
  selectedLabels: string[];
  showUnlabeled: boolean;
  onLabelToggle: (labelId: string) => void;
  onToggleUnlabeled: () => void;
  onClearFilters: () => void;
  onManageLabels: () => void;
  // New advanced filtering props
  onIncludeLabel?: (labelId: string) => void;
  includedLabels?: string[];
  excludedLabels?: string[];
}

export function SearchBar({ 
  searchTerm, 
  onSearchChange, 
  onUpload,
  labels,
  selectedLabels,
  showUnlabeled,
  onLabelToggle,
  onToggleUnlabeled,
  onClearFilters,
  onManageLabels,
  onIncludeLabel,
  includedLabels = [],
  excludedLabels = []
}: SearchBarProps) {
  
  const handleLabelToggle = (labelId: string) => {
    // Use advanced include if available, otherwise fall back to legacy toggle
    if (onIncludeLabel) {
      onIncludeLabel(labelId);
    } else {
      onLabelToggle(labelId);
    }
  };

  // Combine both legacy and advanced selected labels for display
  const allSelectedLabels = Array.from(new Set([...selectedLabels, ...includedLabels]));

  return (
    <div className="flex gap-4 p-6 bg-search-background border-b border-border">
      {/* SmartLabelSearch - Now primary and larger */}
      <div className="flex-1 max-w-md">
        <SmartLabelSearch
          labels={labels}
          selectedLabels={allSelectedLabels}
          onLabelToggle={handleLabelToggle}
          onClearFilters={onClearFilters}
          compact={true}
        />
      </div>
      
      {/* Search Photos - Now secondary and smaller */}
      <div className="relative w-64">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          type="text"
          placeholder="Buscar arquivos..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 h-10"
        />
      </div>
      
      <div className="flex gap-2">
        <Button 
          variant={showUnlabeled ? "default" : "outline"} 
          onClick={onToggleUnlabeled}
          className={`h-10 ${showUnlabeled ? "" : ""}`}
        >
          Sem Labels
        </Button>
        
        <Button 
          variant="outline" 
          onClick={onManageLabels} 
          className="flex items-center gap-2 h-10"
        >
          <Settings className="h-4 w-4" />
          Labels
        </Button>
        
        <Button 
          onClick={onUpload}
          className="flex items-center gap-2 h-10"
        >
          <Upload className="h-4 w-4" />
          Upload
        </Button>
      </div>
    </div>
  );
}