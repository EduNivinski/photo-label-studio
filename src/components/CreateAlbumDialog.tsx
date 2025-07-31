import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LabelChip } from '@/components/LabelChip';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Label as LabelType } from '@/types/photo';
import type { Photo } from '@/types/photo';

interface CreateAlbumDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateAlbum: (name: string, labels: string[], coverPhotoUrl?: string) => Promise<void>;
  selectedLabels: string[];
  labels: LabelType[];
  filteredPhotos: Photo[];
}

export function CreateAlbumDialog({
  isOpen,
  onClose,
  onCreateAlbum,
  selectedLabels,
  labels,
  filteredPhotos
}: CreateAlbumDialogProps) {
  const [albumName, setAlbumName] = useState('');
  const [selectedCoverPhoto, setSelectedCoverPhoto] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!albumName.trim()) return;

    setIsCreating(true);
    try {
      await onCreateAlbum(albumName, selectedLabels, selectedCoverPhoto || undefined);
      setAlbumName('');
      setSelectedCoverPhoto('');
      onClose();
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setAlbumName('');
    setSelectedCoverPhoto('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
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

          {/* Selected Labels */}
          <div className="space-y-2">
            <Label>Labels Incluídas</Label>
            <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-md min-h-[60px]">
              {selectedLabels.length > 0 ? (
                selectedLabels.map(labelId => {
                  const label = labels.find(l => l.id === labelId);
                  return label ? (
                    <LabelChip
                      key={labelId}
                      label={label}
                      isSelected={false}
                      onClick={() => {}}
                      showCount={undefined}
                    />
                  ) : null;
                })
              ) : (
                <p className="text-muted-foreground text-sm">Nenhuma label selecionada</p>
              )}
            </div>
          </div>

          {/* Cover Photo Selection */}
          {filteredPhotos.length > 0 && (
            <div className="space-y-2">
              <Label>Escolher Foto de Capa (Opcional)</Label>
              <ScrollArea className="h-32">
                <div className="grid grid-cols-6 gap-2 p-2">
                  {filteredPhotos.slice(0, 12).map(photo => (
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