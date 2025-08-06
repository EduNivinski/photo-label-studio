import { useState } from 'react';
import { Plus, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StandardLabelCreator } from './StandardLabelCreator';
import { LabelChip } from './LabelChip';
import { useToast } from '@/hooks/use-toast';
import type { Label } from '@/types/photo';

interface UploadLabelSelectorInlineProps {
  labels: Label[];
  selectedLabels: string[];
  onLabelsChange: (labelIds: string[]) => void;
  onCreateLabel?: (name: string, color?: string) => Promise<void>;
}

export function UploadLabelSelectorInline({ 
  labels, 
  selectedLabels,
  onLabelsChange,
  onCreateLabel
}: UploadLabelSelectorInlineProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { toast } = useToast();

  const toggleLabel = (labelId: string) => {
    if (selectedLabels.includes(labelId)) {
      onLabelsChange(selectedLabels.filter(id => id !== labelId));
    } else {
      onLabelsChange([...selectedLabels, labelId]);
    }
  };

  const handleCreateLabel = async (name: string, color?: string) => {
    if (onCreateLabel) {
      await onCreateLabel(name, color);
      toast({
        title: "Label criada",
        description: `A label "${name}" foi criada com sucesso.`,
      });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground">
          Aplicar Labels (Opcional)
        </label>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowCreateDialog(true)}
          className="h-6 text-xs text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3 w-3 mr-1" />
          Nova Label
        </Button>
      </div>

      {/* Selected Labels */}
      {selectedLabels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedLabels.map(labelId => {
            const label = labels.find(l => l.id === labelId);
            if (!label) return null;
            
            return (
              <Badge
                key={labelId}
                variant="secondary"
                className="text-xs cursor-pointer"
                onClick={() => toggleLabel(labelId)}
                style={{
                  backgroundColor: label.color ? `${label.color}20` : undefined,
                  borderColor: label.color || undefined,
                  color: label.color || undefined,
                }}
              >
                {label.name} ✕
              </Badge>
            );
          })}
        </div>
      )}

      {/* Available Labels */}
      <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
        {labels
          .filter(label => !selectedLabels.includes(label.id))
          .slice(0, 10) // Limit to first 10 labels
          .map(label => (
            <LabelChip
              key={label.id}
              label={label}
              isSelected={false}
              onClick={() => toggleLabel(label.id)}
              size="sm"
            />
          ))}
      </div>

      {/* Create Label Dialog */}
      <StandardLabelCreator
        trigger={<></>}
        isOpen={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreateLabel={handleCreateLabel}
      />
    </div>
  );
}