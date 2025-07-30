import { useState } from 'react';
import { Plus, Minus, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label as UILabel } from '@/components/ui/label';
import { LabelChip } from './LabelChip';
import type { Photo, Label } from '@/types/photo';

interface BulkLabelDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPhotos: Photo[];
  labels: Label[];
  onApplyLabels: (photoIds: string[], labelIds: string[]) => Promise<void>;
  onRemoveLabels: (photoIds: string[], labelIds: string[]) => Promise<void>;
  onCreateLabel?: (name: string, color?: string) => Promise<void>;
}

export function BulkLabelDialog({
  isOpen,
  onClose,
  selectedPhotos,
  labels,
  onApplyLabels,
  onRemoveLabels,
  onCreateLabel
}: BulkLabelDialogProps) {
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [isApplying, setIsApplying] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [isCreatingLabel, setIsCreatingLabel] = useState(false);

  const handleLabelToggle = (labelId: string) => {
    setSelectedLabels(prev => 
      prev.includes(labelId)
        ? prev.filter(id => id !== labelId)
        : [...prev, labelId]
    );
  };

  const handleApplyLabels = async () => {
    if (selectedLabels.length === 0) return;
    
    setIsApplying(true);
    try {
      const photoIds = selectedPhotos.map(p => p.id);
      await onApplyLabels(photoIds, selectedLabels);
      setSelectedLabels([]);
      onClose();
    } finally {
      setIsApplying(false);
    }
  };

  const handleRemoveLabels = async () => {
    if (selectedLabels.length === 0) return;
    
    setIsApplying(true);
    try {
      const photoIds = selectedPhotos.map(p => p.id);
      await onRemoveLabels(photoIds, selectedLabels);
      setSelectedLabels([]);
      onClose();
    } finally {
      setIsApplying(false);
    }
  };

  const handleCreateLabel = async () => {
    if (!newLabelName.trim() || !onCreateLabel) return;
    
    setIsCreatingLabel(true);
    try {
      await onCreateLabel(newLabelName.trim());
      setNewLabelName('');
    } finally {
      setIsCreatingLabel(false);
    }
  };

  const handleClose = () => {
    setSelectedLabels([]);
    setNewLabelName('');
    onClose();
  };

  // Get common labels across all selected photos
  const commonLabels = labels.filter(label => 
    selectedPhotos.every(photo => photo.labels.includes(label.id))
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Gerenciar Labels - {selectedPhotos.length} foto{selectedPhotos.length !== 1 ? 's' : ''}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Common Labels */}
          {commonLabels.length > 0 && (
            <div className="space-y-3">
              <UILabel className="text-sm font-medium text-muted-foreground">
                Labels comuns a todas as fotos selecionadas:
              </UILabel>
              <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-lg">
                {commonLabels.map(label => (
                  <LabelChip
                    key={label.id}
                    label={label}
                    isSelected={false}
                    onClick={() => {}}
                    variant="tag"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Create New Label */}
          {onCreateLabel && (
            <div className="space-y-3">
              <UILabel className="text-sm font-medium">
                Criar Nova Label:
              </UILabel>
              <div className="flex gap-2">
                <Input
                  value={newLabelName}
                  onChange={(e) => setNewLabelName(e.target.value)}
                  placeholder="Nome da nova label..."
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateLabel()}
                />
                <Button
                  onClick={handleCreateLabel}
                  disabled={!newLabelName.trim() || isCreatingLabel}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Criar
                </Button>
              </div>
            </div>
          )}

          {/* Label Selection */}
          <div className="space-y-3">
            <UILabel className="text-sm font-medium">
              Selecionar Labels ({selectedLabels.length} selecionada{selectedLabels.length !== 1 ? 's' : ''}):
            </UILabel>
            
            <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto p-2 border rounded-lg">
              {labels.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center w-full py-4">
                  Nenhuma label disponível. Crie labels primeiro!
                </p>
              ) : (
                labels.map((label) => (
                  <LabelChip
                    key={label.id}
                    label={label}
                    isSelected={selectedLabels.includes(label.id)}
                    onClick={() => handleLabelToggle(label.id)}
                    variant="filter"
                  />
                ))
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={handleApplyLabels}
              disabled={selectedLabels.length === 0 || isApplying}
              className="flex-1"
            >
              <Plus className="h-4 w-4 mr-2" />
              Aplicar Labels
            </Button>
            
            <Button
              variant="outline"
              onClick={handleRemoveLabels}
              disabled={selectedLabels.length === 0 || isApplying}
              className="flex-1"
            >
              <Minus className="h-4 w-4 mr-2" />
              Remover Labels
            </Button>
          </div>

          <Button variant="ghost" onClick={handleClose} className="w-full">
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}