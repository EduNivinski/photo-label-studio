import { useState, useEffect } from 'react';
import { Edit, Save, X, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Label as LabelType } from '@/types/photo';

interface EditLabelDialogProps {
  isOpen: boolean;
  onClose: () => void;
  label: LabelType | null;
  onUpdateLabel: (labelId: string, name: string, color: string) => Promise<boolean>;
}

const COLOR_PALETTE = [
  '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16',
  '#22C55E', '#10B981', '#06B6D4', '#0EA5E9', '#3B82F6',
  '#6366F1', '#8B5CF6', '#A855F7', '#D946EF', '#EC4899',
  '#F43F5E', '#64748B', '#6B7280', '#374151', '#1F2937'
];

export function EditLabelDialog({ isOpen, onClose, label, onUpdateLabel }: EditLabelDialogProps) {
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState('#6B7280');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (label) {
      setName(label.name);
      setSelectedColor(label.color || '#6B7280');
    }
  }, [label]);

  const handleSave = async () => {
    if (!label || !name.trim()) return;
    
    setIsLoading(true);
    try {
      const success = await onUpdateLabel(label.id, name.trim(), selectedColor);
      if (success) {
        onClose();
      }
    } catch (error) {
      console.error('Error updating label:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (label) {
      setName(label.name);
      setSelectedColor(label.color || '#6B7280');
    }
    onClose();
  };

  if (!label) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5 text-primary" />
            Editar Label
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Nome da Label */}
          <div className="space-y-2">
            <Label htmlFor="label-name" className="text-sm font-medium">
              Nome da Label
            </Label>
            <Input
              id="label-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Digite o nome da label..."
              className="w-full"
            />
          </div>

          {/* Paleta de Cores */}
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Cor da Label
            </Label>
            
            {/* Preview da cor selecionada */}
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <div 
                className="w-8 h-8 rounded-full border-2 border-background shadow-sm"
                style={{ backgroundColor: selectedColor }}
              />
              <div className="flex-1">
                <p className="text-sm font-medium">Pré-visualização</p>
                <div 
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium"
                  style={{ 
                    backgroundColor: selectedColor + '20',
                    color: selectedColor,
                    border: `1px solid ${selectedColor}40`
                  }}
                >
                  🏷️ {name || 'Nome da Label'}
                </div>
              </div>
            </div>

            {/* Grid de cores */}
            <div className="grid grid-cols-5 gap-2">
              {COLOR_PALETTE.map((color) => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className={`w-10 h-10 rounded-lg border-2 transition-all hover:scale-110 ${
                    selectedColor === color 
                      ? 'border-foreground ring-2 ring-primary ring-offset-2' 
                      : 'border-border hover:border-muted-foreground'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Ações */}
        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button 
            variant="outline" 
            onClick={handleCancel}
            disabled={isLoading}
            className="gap-2"
          >
            <X className="h-4 w-4" />
            Cancelar
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!name.trim() || isLoading}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            {isLoading ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}