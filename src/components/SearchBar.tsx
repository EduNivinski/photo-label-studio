import { Search, Upload } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface SearchBarProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onUpload: () => void;
}

export function SearchBar({ searchTerm, onSearchChange, onUpload }: SearchBarProps) {
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
      <Button onClick={onUpload} className="flex items-center gap-2">
        <Upload className="h-4 w-4" />
        Upload
      </Button>
    </div>
  );
}