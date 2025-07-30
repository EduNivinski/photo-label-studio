import { useState } from 'react';
import { Plus, Edit, Trash2, Palette } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label as UILabel } from '@/components/ui/label';
import { LabelChip } from './LabelChip';
import { useToast } from '@/hooks/use-toast';
import type { Label, Photo } from '@/types/photo';

interface LabelManagerProps {
  isOpen: boolean;
  onClose: () => void;
  labels: Label[];
  selectedPhoto?: Photo;
  onCreateLabel: (name: string, color?: string) => Promise<void>;
  onDeleteLabel: (labelId: string) => Promise<boolean>;
  onUpdatePhotoLabels?: (photoId: string, labelIds: string[]) => Promise<boolean>;
}

const PRESET_COLORS = [
  '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', 
  '#06B6D4', '#84CC16', '#6B7280', '#EC4899',
  '#F97316', '#3B82F6', '#8B5A2B', '#059669'
];

export function LabelManager({ 
  isOpen, 
  onClose, 
  labels, 
  selectedPhoto,
  onCreateLabel, 
  onDeleteLabel,
  onUpdatePhotoLabels 
}: LabelManagerProps) {
  const [newLabelName, setNewLabelName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
  const [isCreating, setIsCreating] = useState(false);
  const [photoLabels, setPhotoLabels] = useState<string[]>(selectedPhoto?.labels || []);
  const { toast } = useToast();

  const handleCreateLabel = async () => {
    if (!newLabelName.trim()) return;
    
    setIsCreating(true);
    try {
      await onCreateLabel(newLabelName.trim(), selectedColor);
      setNewLabelName('');
      toast({
        title: "Label criada",
        description: `Label "${newLabelName.trim()}" criada com sucesso!`
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao criar label. Verifique se o nome não está em uso.",
        variant: "destructive"
      });
    }
    setIsCreating(false);
  };

  const handleDeleteLabel = async (labelId: string) => {
    const label = labels.find(l => l.id === labelId);
    if (!label) return;

    const success = await onDeleteLabel(labelId);
    if (success) {
      toast({
        title: "Label excluída",
        description: `Label "${label.name}" foi removida de todas as fotos.`
      });
      // Remove from current photo labels if present
      setPhotoLabels(prev => prev.filter(id => id !== labelId));
    } else {
      toast({
        title: "Erro",
        description: "Falha ao excluir label.",
        variant: "destructive"
      });
    }
  };

  const handlePhotoLabelToggle = (labelId: string) => {
    setPhotoLabels(prev => 
      prev.includes(labelId)
        ? prev.filter(id => id !== labelId)
        : [...prev, labelId]
    );
  };

  const handleSavePhotoLabels = async () => {
    if (!selectedPhoto || !onUpdatePhotoLabels) return;
    
    const success = await onUpdatePhotoLabels(selectedPhoto.id, photoLabels);
    if (success) {
      toast({
        title: "Labels atualizadas",
        description: "Labels da foto foram atualizadas com sucesso!"
      });
      onClose();
    } else {
      toast({
        title: "Erro",
        description: "Falha ao atualizar labels da foto.",
        variant: "destructive"
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {selectedPhoto ? `Gerenciar Labels - ${selectedPhoto.name}` : 'Gerenciar Labels'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Create New Label */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Criar Nova Label</h3>
            <div className="flex gap-2">
              <div className="flex-1">
                <UILabel htmlFor="label-name">Nome da Label</UILabel>
                <Input
                  id="label-name"
                  placeholder="Ex: Família, Trabalho, Viagem..."
                  value={newLabelName}
                  onChange={(e) => setNewLabelName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateLabel()}
                />
              </div>
              <div>
                <UILabel>Cor</UILabel>
                <div className="flex gap-1 mt-1">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        selectedColor === color ? 'border-foreground scale-110' : 'border-border'
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setSelectedColor(color)}
                    />
                  ))}
                </div>
              </div>
            </div>
            <Button 
              onClick={handleCreateLabel} 
              disabled={!newLabelName.trim() || isCreating}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              {isCreating ? 'Criando...' : 'Criar Label'}
            </Button>
          </div>

          {/* Photo Labels (if editing a specific photo) */}
          {selectedPhoto && (
            <div className="space-y-4 border-t pt-4">
              <h3 className="text-lg font-medium">Labels desta Foto</h3>
              <div className="flex flex-wrap gap-2">
                {labels.map((label) => (
                  <LabelChip
                    key={label.id}
                    label={label}
                    isSelected={photoLabels.includes(label.id)}
                    onClick={() => handlePhotoLabelToggle(label.id)}
                    variant="filter"
                  />
                ))}
              </div>
              <Button onClick={handleSavePhotoLabels} className="w-full">
                Salvar Labels da Foto
              </Button>
            </div>
          )}

          {/* Existing Labels */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-lg font-medium">Todas as Labels ({labels.length})</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
              {labels.map((label) => (
                <div 
                  key={label.id} 
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                >
                  <LabelChip label={label} variant="tag" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteLabel(label.id)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            {labels.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma label criada ainda. Crie sua primeira label acima!
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
