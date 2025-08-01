import { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LabelChip } from './LabelChip';
import type { Label } from '@/types/photo';

interface SmartLabelSearchProps {
  labels: Label[];
  selectedLabels: string[];
  onLabelToggle: (labelId: string) => void;
  onClearFilters: () => void;
}

export function SmartLabelSearch({ 
  labels, 
  selectedLabels, 
  onLabelToggle, 
  onClearFilters 
}: SmartLabelSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredLabels = labels.filter(label => 
    label.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    !selectedLabels.includes(label.id)
  );

  const selectedLabelObjects = labels.filter(label => 
    selectedLabels.includes(label.id)
  );

  const handleInputFocus = () => {
    setShowSuggestions(true);
  };

  const handleInputBlur = (e: React.FocusEvent) => {
    // Only hide if not clicking on the dropdown
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!relatedTarget || !relatedTarget.closest('[data-dropdown="suggestions"]')) {
      setTimeout(() => setShowSuggestions(false), 200);
    }
  };

  const handleLabelAdd = (labelId: string) => {
    onLabelToggle(labelId);
    setSearchTerm('');
    inputRef.current?.focus();
  };

  const handleLabelRemove = (labelId: string) => {
    onLabelToggle(labelId);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowSuggestions(false);
        inputRef.current?.blur();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="relative max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Pesquisar labels..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          className="pl-10 pr-10"
        />
        {selectedLabels.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Selected Labels Chips */}
      {selectedLabelObjects.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selectedLabelObjects.map((label) => (
            <LabelChip
              key={label.id}
              label={label}
              variant="filter"
              isSelected={true}
              onRemove={() => handleLabelRemove(label.id)}
            />
          ))}
        </div>
      )}

      {/* Suggestions Dropdown */}
      {showSuggestions && filteredLabels.length > 0 && (
        <div 
          className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto"
          data-dropdown="suggestions"
        >
          <div className="p-2 space-y-1">
            {filteredLabels.slice(0, 8).map((label) => (
              <div
                key={label.id}
                onClick={() => handleLabelAdd(label.id)}
                onMouseDown={(e) => e.preventDefault()} // Prevent blur when clicking
                className="flex items-center px-2 py-2 rounded cursor-pointer hover:bg-accent hover:text-accent-foreground"
              >
                <div 
                  className="w-3 h-3 rounded-full mr-2 flex-shrink-0"
                  style={{ backgroundColor: label.color || '#8B5CF6' }}
                />
                <span className="text-sm">{label.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}