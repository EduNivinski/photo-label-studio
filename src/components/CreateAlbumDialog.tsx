import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LabelChip } from '@/components/LabelChip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import type { Label as LabelType } from '@/types/photo';
import type { Photo } from '@/types/photo';

interface CreateAlbumDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateAlbum: (name: string, labels: string[], coverPhotoUrl?: string) => Promise<void>;
  selectedLabels: string[];
  labels: LabelType[];
  filteredPhotos: Photo[];
  onCreateLabel?: (name: string, color?: string) => Promise<void>;
}

export function CreateAlbumDialog({
  isOpen,
  onClose,
  onCreateAlbum,
  selectedLabels: initialSelectedLabels,
  labels,
  filteredPhotos,
  onCreateLabel
}: CreateAlbumDialogProps) {
  const [albumName, setAlbumName] = useState('');
  const [selectedCoverPhoto, setSelectedCoverPhoto] = useState<string>('');
  const [selectedLabels, setSelectedLabels] = useState<string[]>(initialSelectedLabels);
  const [isCreating, setIsCreating] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [isCreatingLabel, setIsCreatingLabel] = useState(false);

  const handleCreate = async () => {
    if (!albumName.trim() || selectedLabels.length === 0) return;

    setIsCreating(true);
    try {
      await onCreateAlbum(albumName, selectedLabels, selectedCoverPhoto || undefined);
      setAlbumName('');
      setSelectedCoverPhoto('');
      setSelectedLabels([]);
      setNewLabelName('');
      onClose();
    } finally {
      setIsCreating(false);
    }
  };

  const handleLabelToggle = (labelId: string) => {
    setSelectedLabels(prev => 
      prev.includes(labelId)
        ? prev.filter(id => id !== labelId)
        : [...prev, labelId]
    );
  };

  const handleCreateNewLabel = async () => {
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
    setAlbumName('');
    setSelectedCoverPhoto('');
    setSelectedLabels(initialSelectedLabels);
    setNewLabelName('');
    onClose();
  };

  // Filter photos based on selected labels for preview
  const previewPhotos = selectedLabels.length > 0 
    ? filteredPhotos.filter(photo => 
        selectedLabels.every(labelId => photo.labels.includes(labelId))
      )
    : filteredPhotos;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar Álbum Inteligente</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Album Name */}
          <div className="space-y-2">
            <Label htmlFor="album-name">Nome do Álbum</Label>
            <Input
              id="album-name"
              value={albumName}
              onChange={(e) => setAlbumName(e.target.value)}
              placeholder="Ex: Viagem ao Canadá no Inverno"
            />
          </div>

          {/* Label Selection */}
          <div className="space-y-4">
            <Label>Selecionar Labels</Label>
            
            {/* Create New Label */}
            {onCreateLabel && (
              <div className="flex gap-2">
                <Input
                  value={newLabelName}
                  onChange={(e) => setNewLabelName(e.target.value)}
                  placeholder="Nova label..."
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateNewLabel()}
                />
                <Button
                  type="button"
                  onClick={handleCreateNewLabel}
                  disabled={!newLabelName.trim() || isCreatingLabel}
                  variant="outline"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {isCreatingLabel ? 'Criando...' : 'Criar'}
                </Button>
              </div>
            )}

            {/* Available Labels */}
            <div className="border rounded-lg p-4 max-h-48 overflow-y-auto">
              <div className="flex flex-wrap gap-2">
                {labels.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nenhuma label disponível</p>
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

            {/* Selected Labels Summary */}
            <div className="space-y-2">
              <Label>Labels Selecionadas ({selectedLabels.length})</Label>
              <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-md min-h-[60px]">
                {selectedLabels.length > 0 ? (
                  selectedLabels.map(labelId => {
                    const label = labels.find(l => l.id === labelId);
                    return label ? (
                      <LabelChip
                        key={labelId}
                        label={label}
                        isSelected={true}
                        onClick={() => handleLabelToggle(label.id)}
                        variant="tag"
                        onRemove={() => handleLabelToggle(label.id)}
                      />
                    ) : null;
                  })
                ) : (
                  <p className="text-muted-foreground text-sm">Selecione pelo menos uma label acima</p>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Preview and Cover Photo Selection */}
          {previewPhotos.length > 0 && (
            <div className="space-y-4">
              <div>
                <Label>Pré-visualização do Álbum</Label>
                <p className="text-sm text-muted-foreground">
                  {previewPhotos.length} foto{previewPhotos.length !== 1 ? 's' : ''} {previewPhotos.length !== 1 ? 'correspondem' : 'corresponde'} às labels selecionadas
                </p>
              </div>
              
              <div className="space-y-2">
                <Label>Escolher Foto de Capa (Opcional)</Label>
                <ScrollArea className="h-32">
                  <div className="grid grid-cols-6 gap-2 p-2">
                    {previewPhotos.slice(0, 12).map(photo => (
                    <button
                      key={photo.id}
                      onClick={() => setSelectedCoverPhoto(
                        selectedCoverPhoto === photo.url ? '' : photo.url
                      )}
                      className={`relative aspect-square rounded overflow-hidden border-2 transition-all ${
                        selectedCoverPhoto === photo.url 
                          ? 'border-primary' 
                          : 'border-border hover:border-muted-foreground'
                      }`}
                    >
                      <img
                        src={photo.url}
                        alt={photo.name}
                        className="w-full h-full object-cover"
                      />
                      {selectedCoverPhoto === photo.url && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          <div className="w-4 h-4 bg-primary rounded-full" />
                        </div>
                      )}
                    </button>
                  ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCreate} 
              disabled={!albumName.trim() || selectedLabels.length === 0 || isCreating}
            >
              {isCreating ? 'Criando...' : 'Criar Álbum'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}