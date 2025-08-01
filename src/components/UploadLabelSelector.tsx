import { useState } from 'react';
import { Plus, Tag } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { StandardLabelCreator } from './StandardLabelCreator';
import { LabelChip } from './LabelChip';
import { useToast } from '@/hooks/use-toast';
import type { Label } from '@/types/photo';

interface UploadLabelSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  labels: Label[];
  onCreateLabel: (name: string, color?: string) => Promise<void>;
  onApplyLabels: (labelIds: string[]) => Promise<void>;
  uploadedFilesCount: number;
}

export function UploadLabelSelector({ 
  isOpen, 
  onClose, 
  labels, 
  onCreateLabel,
  onApplyLabels,
  uploadedFilesCount 
}: UploadLabelSelectorProps) {
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { toast } = useToast();

  const handleLabelToggle = (labelId: string) => {
    setSelectedLabels(prev => 
      prev.includes(labelId)
        ? prev.filter(id => id !== labelId)
        : [...prev, labelId]
    );
  };

  const handleApplyLabels = async () => {
    try {
      await onApplyLabels(selectedLabels);
      setSelectedLabels([]);
      onClose();
      toast({
        title: "Labels aplicadas",
        description: `${selectedLabels.length} label(s) aplicada(s) a ${uploadedFilesCount} arquivo(s)!`
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao aplicar labels. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const handleSkip = () => {
    setSelectedLabels([]);
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Aplicar Labels aos Arquivos Enviados
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            <div className="text-sm text-muted-foreground">
              {uploadedFilesCount} arquivo(s) enviado(s) com sucesso! 
              Selecione labels para aplicar a todos eles:
            </div>

            {/* Create Label Button */}
            <div className="flex justify-start">
              <StandardLabelCreator
                trigger={
                  <Button variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Nova Label
                  </Button>
                }
                onCreateLabel={onCreateLabel}
                isOpen={showCreateDialog}
                onOpenChange={setShowCreateDialog}
              />
            </div>

            {/* Existing Labels */}
            <div className="space-y-3">
              <h4 className="font-medium">Labels Disponíveis ({labels.length})</h4>
              {labels.length > 0 ? (
                <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto">
                  {labels.map((label) => (
                    <LabelChip
                      key={label.id}
                      label={label}
                      isSelected={selectedLabels.includes(label.id)}
                      onClick={() => handleLabelToggle(label.id)}
                      variant="filter"
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma label disponível. Crie sua primeira label!
                </div>
              )}
            </div>

            {/* Selected Labels */}
            {selectedLabels.length > 0 && (
              <div className="space-y-2 border-t pt-4">
                <h4 className="font-medium">Labels Selecionadas ({selectedLabels.length})</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedLabels.map((labelId) => {
                    const label = labels.find(l => l.id === labelId);
                    return label ? (
                      <LabelChip
                        key={label.id}
                        label={label}
                        variant="tag"
                        size="sm"
                      />
                    ) : null;
                  })}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4">
              <Button 
                onClick={handleApplyLabels}
                disabled={selectedLabels.length === 0}
                className="flex-1"
              >
                Aplicar {selectedLabels.length > 0 ? selectedLabels.length : ''} Label(s)
              </Button>
              <Button variant="outline" onClick={handleSkip}>
                Pular
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
