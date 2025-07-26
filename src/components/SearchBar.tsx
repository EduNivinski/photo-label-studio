import { Search, Upload, Settings } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AdvancedFilters } from './AdvancedFilters';
import type { Label } from '@/types/photo';

interface SearchBarProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onUpload: () => void;
  labels: Label[];
  selectedLabels: string[];
  filterMode: 'AND' | 'OR';
  onLabelToggle: (labelId: string) => void;
  onFilterModeChange: (mode: 'AND' | 'OR') => void;
  onClearFilters: () => void;
  onManageLabels: () => void;
}

export function SearchBar({ 
  searchTerm, 
  onSearchChange, 
  onUpload,
  labels,
  selectedLabels,
  filterMode,
  onLabelToggle,
  onFilterModeChange,
  onClearFilters,
  onManageLabels
}: SearchBarProps) {
  return (
    <div className="flex gap-4 p-6 bg-search-background border-b border-border">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          type="text"
          placeholder="Buscar fotos..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>
      
      <div className="flex gap-2">
        <AdvancedFilters
          labels={labels}
          selectedLabels={selectedLabels}
          filterMode={filterMode}
          onLabelToggle={onLabelToggle}
          onFilterModeChange={onFilterModeChange}
          onClearFilters={onClearFilters}
        />
        
        <Button variant="outline" onClick={onManageLabels} className="flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Labels
        </Button>
        
        <Button onClick={onUpload} className="flex items-center gap-2">
          <Upload className="h-4 w-4" />
          Upload
        </Button>
      </div>
    </div>
  );
}