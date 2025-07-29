import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { LabelChip } from './LabelChip';
import type { Label } from '@/types/photo';

interface QuickLabelSelectorProps {
  labels: Label[];
  photoLabels: string[];
  onAddLabel: (labelId: string) => void;
  children: React.ReactNode;
}

export function QuickLabelSelector({ 
  labels, 
  photoLabels, 
  onAddLabel, 
  children 
}: QuickLabelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Labels disponíveis para adicionar (que não estão na foto)
  const availableLabels = labels.filter(label => !photoLabels.includes(label.id));

  const handleAddLabel = (labelId: string) => {
    onAddLabel(labelId);
    setIsOpen(false);
  };

  if (availableLabels.length === 0) {
    return <>{children}</>;
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start" side="top">
        <div className="space-y-3">
          <div className="text-xs font-medium text-muted-foreground">
            Adicionar Label:
          </div>
          <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto">
            {availableLabels.map((label) => (
              <LabelChip
                key={label.id}
                label={label}
                variant="filter"
                onClick={() => handleAddLabel(label.id)}
              />
            ))}
          </div>
          {availableLabels.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">
              Todas as labels já foram aplicadas
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}