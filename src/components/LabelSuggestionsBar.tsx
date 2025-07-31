import { useMemo } from 'react';
import { LabelChip } from './LabelChip';
import { Badge } from '@/components/ui/badge';
import type { Label, Photo } from '@/types/photo';

interface LabelSuggestionsBarProps {
  labels: Label[];
  photos: Photo[];
  onLabelToggle: (labelId: string) => void;
  onToggleUnlabeled: () => void;
  selectedLabels: string[];
  showUnlabeled: boolean;
}

export function LabelSuggestionsBar({ 
  labels, 
  photos, 
  onLabelToggle,
  onToggleUnlabeled,
  selectedLabels,
  showUnlabeled 
}: LabelSuggestionsBarProps) {
  // Calcular labels mais usadas
  const popularLabels = useMemo(() => {
    const labelCounts = new Map<string, number>();
    
    photos.forEach(photo => {
      photo.labels.forEach(labelId => {
        labelCounts.set(labelId, (labelCounts.get(labelId) || 0) + 1);
      });
    });

    return labels
      .map(label => ({
        ...label,
        count: labelCounts.get(label.id) || 0
      }))
      .filter(label => label.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 labels
  }, [labels, photos]);

  if (popularLabels.length === 0) {
    return null;
  }

  return (
    <div className="px-6 py-4 bg-card border-b border-border">
      <h3 className="text-sm font-medium text-foreground mb-3">Sugestões de Labels</h3>
      <div className="flex flex-wrap gap-2">
        {popularLabels.map((label) => (
          <LabelChip
            key={label.id}
            label={label}
            isSelected={selectedLabels.includes(label.id)}
            onClick={() => onLabelToggle(label.id)}
            variant="filter"
            showCount={label.count}
          />
        ))}
        
        {/* Chip "Sem Labels" */}
        <Badge
          variant={showUnlabeled ? "default" : "outline"}
          className="cursor-pointer hover:bg-muted-foreground/10 transition-colors"
          onClick={onToggleUnlabeled}
        >
          🏷️ Sem Labels ({photos.filter(p => p.labels.length === 0).length})
        </Badge>
      </div>
    </div>
  );
}