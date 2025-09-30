import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label as UILabel } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface StandardLabelCreatorProps {
  trigger: React.ReactNode;
  onCreateLabel: (name: string, color?: string) => Promise<void>;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialName?: string;
}

const PRESET_COLORS = [
  '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', 
  '#06B6D4', '#84CC16', '#6B7280', '#EC4899',
  '#F97316', '#3B82F6', '#8B5A2B', '#059669'
];

export function StandardLabelCreator({ 
  trigger, 
  onCreateLabel, 
  isOpen, 
  onOpenChange,
  initialName 
}: StandardLabelCreatorProps) {
  const [newLabelName, setNewLabelName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
  const [isCreating, setIsCreating] = useState(false);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const handleOpen = (openState: boolean) => {
    if (onOpenChange) {
      onOpenChange(openState);
    } else {
      setOpen(openState);
    }
    // Set initial name when dialog opens
    if (openState && initialName) {
      setNewLabelName(initialName);
    } else if (!openState) {
      setNewLabelName('');
    }
  };

  const isDialogOpen = isOpen !== undefined ? isOpen : open;

  const handleCreateLabel = async () => {
    if (!newLabelName.trim()) return;
    
    setIsCreating(true);
    try {
      await onCreateLabel(newLabelName.trim(), selectedColor);
      setNewLabelName('');
      handleOpen(false);
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreateLabel();
    }
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Criar Nova Label</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <UILabel htmlFor="label-name">Nome da Label</UILabel>
            <Input
              id="label-name"
              placeholder="Ex: Família, Trabalho, Viagem..."
              value={newLabelName}
              onChange={(e) => setNewLabelName(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          </div>
          
          <div>
            <UILabel>Cor</UILabel>
            <div className="flex gap-2 mt-2 flex-wrap">
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

          <div className="flex gap-2 pt-2">
            <Button 
              onClick={handleCreateLabel} 
              disabled={!newLabelName.trim() || isCreating}
              className="flex-1"
            >
              <Plus className="h-4 w-4 mr-2" />
              {isCreating ? 'Criando...' : 'Criar'}
            </Button>
            <Button 
              variant="outline"
              onClick={() => handleOpen(false)}
              disabled={isCreating}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}