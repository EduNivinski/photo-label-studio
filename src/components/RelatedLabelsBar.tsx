import { Plus, X, Ban } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Label } from '@/types/photo';

interface RelatedLabelsBarProps {
  relatedLabels: { labelId: string; count: number }[];
  allLabels: Label[];
  includedLabels: string[];
  excludedLabels: string[];
  onIncludeLabel: (labelId: string) => void;
  onExcludeLabel: (labelId: string) => void;
  onRemoveLabel: (labelId: string) => void;
}

export function RelatedLabelsBar({
  relatedLabels,
  allLabels,
  includedLabels,
  excludedLabels,
  onIncludeLabel,
  onExcludeLabel,
  onRemoveLabel
}: RelatedLabelsBarProps) {
  // Debug: Show a message if no filters are active
  if (includedLabels.length === 0 && excludedLabels.length === 0) {
    return (
      <div className="bg-muted/30 border-b border-border p-4">
        <p className="text-sm text-muted-foreground italic">
          💡 Dica: Selecione uma label acima para ver as "Labels Relacionadas" e poder incluir/excluir outras labels dinamicamente
        </p>
      </div>
    );
  }

  const getLabelName = (labelId: string) => {
    const label = allLabels.find(l => l.id === labelId);
    return label?.name || labelId;
  };

  const getLabelColor = (labelId: string) => {
    const label = allLabels.find(l => l.id === labelId);
    return label?.color;
  };

  return (
    <div className="bg-muted/30 border-b border-border p-4 space-y-3">
      {/* Active Filters Section */}
      {(includedLabels.length > 0 || excludedLabels.length > 0) && (
        <div>
          <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
            <span>Filtros Ativos</span>
            <span className="text-xs text-muted-foreground">
              ({includedLabels.length + excludedLabels.length})
            </span>
          </h3>
          <div className="flex flex-wrap gap-2">
            {/* Included Labels */}
            {includedLabels.map(labelId => (
              <Badge
                key={`included-${labelId}`}
                variant="default"
                className="gap-1 cursor-pointer hover:scale-105 transition-all"
                style={getLabelColor(labelId) ? {
                  backgroundColor: getLabelColor(labelId),
                  borderColor: getLabelColor(labelId),
                  color: '#ffffff'
                } : undefined}
                onClick={() => onRemoveLabel(labelId)}
              >
                <Plus className="h-3 w-3" />
                {getLabelName(labelId)}
                <X className="h-3 w-3 ml-1 hover:bg-black/20 rounded" />
              </Badge>
            ))}
            
            {/* Excluded Labels */}
            {excludedLabels.map(labelId => (
              <Badge
                key={`excluded-${labelId}`}
                variant="destructive"
                className="gap-1 cursor-pointer hover:scale-105 transition-all"
                onClick={() => onRemoveLabel(labelId)}
              >
                <Ban className="h-3 w-3" />
                {getLabelName(labelId)}
                <X className="h-3 w-3 ml-1 hover:bg-black/20 rounded" />
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Related Labels Section */}
      {relatedLabels.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
            <span>Labels Relacionadas</span>
            <span className="text-xs text-muted-foreground">
              Clique para incluir (✓) ou excluir (✗)
            </span>
          </h3>
          <div className="flex flex-wrap gap-2">
            {relatedLabels.map(({ labelId, count }) => {
              const isExcluded = excludedLabels.includes(labelId);
              const labelColor = getLabelColor(labelId);
              
              return (
                <div key={labelId} className="flex gap-1">
                  <Badge
                    variant="outline"
                    className={`cursor-pointer hover:scale-105 transition-all border ${
                      isExcluded ? 'opacity-50' : ''
                    }`}
                    style={labelColor && !isExcluded ? {
                      borderColor: labelColor,
                      color: labelColor
                    } : undefined}
                    onClick={() => onIncludeLabel(labelId)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    {getLabelName(labelId)} ({count})
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => onExcludeLabel(labelId)}
                  >
                    <Ban className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}