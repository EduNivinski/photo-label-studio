import { LabelChip } from './LabelChip';
import type { Label } from '@/types/photo';

interface LabelFilterProps {
  labels: Label[];
  selectedLabels: string[];
  onLabelToggle: (labelId: string) => void;
}

export function LabelFilter({ labels, selectedLabels, onLabelToggle }: LabelFilterProps) {
  return (
    <div className="p-6 border-b border-border">
      <h3 className="text-sm font-medium text-foreground mb-3">Filtrar por Labels</h3>
      <div className="flex flex-wrap gap-2">
        {labels.map((label) => (
          <LabelChip
            key={label.id}
            label={label}
            isSelected={selectedLabels.includes(label.id)}
            onClick={() => onLabelToggle(label.id)}
            variant="filter"
          />
        ))}
      </div>
      {selectedLabels.length > 0 && (
        <div className="mt-3 text-xs text-muted-foreground">
          {selectedLabels.length} label{selectedLabels.length !== 1 ? 's' : ''} selecionada{selectedLabels.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}