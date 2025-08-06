import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LabelChip } from '@/components/LabelChip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import type { Album } from '@/types/album';
import type { Label as LabelType } from '@/types/photo';
import type { Photo } from '@/types/photo';

interface EditAlbumDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdateAlbum: (id: string, updates: Partial<Pick<Album, 'name' | 'labels' | 'cover_photo_url'>>) => Promise<void>;
  album: Album | null;
  labels: LabelType[];
  photos: Photo[];
}

export function EditAlbumDialog({
  isOpen,
  onClose,
  onUpdateAlbum,
  album,
  labels,
  photos
}: EditAlbumDialogProps) {
  const [albumName, setAlbumName] = useState('');
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [selectedCoverPhoto, setSelectedCoverPhoto] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Get photos that match current selected labels
  const matchingPhotos = photos.filter(photo => 
    selectedLabels.length === 0 || selectedLabels.every(labelId => photo.labels.includes(labelId))
  );

  useEffect(() => {
    if (album) {
      setAlbumName(album.name);
      setSelectedLabels(album.labels);
      setSelectedCoverPhoto(album.cover_photo_url || '');
    }
  }, [album]);

  const handleUpdate = async () => {
    if (!album || !albumName.trim()) return;

    setIsUpdating(true);
    try {
      await onUpdateAlbum(album.id, {
        name: albumName,
        labels: selectedLabels,
        cover_photo_url: selectedCoverPhoto || undefined
      });
      onClose();
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClose = () => {
    onClose();
  };

  const toggleLabel = (labelId: string) => {
    setSelectedLabels(prev => 
      prev.includes(labelId) 
        ? prev.filter(id => id !== labelId)
        : [...prev, labelId]
    );
  };

  if (!album) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Editar Coleção</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6">
            {/* Collection Name */}
            <div className="space-y-2">
              <Label htmlFor="album-name">Nome da Coleção</Label>
              <Input
                id="album-name"
                value={albumName}
                onChange={(e) => setAlbumName(e.target.value)}
                placeholder="Ex: Viagem ao Canadá no Inverno"
              />
            </div>

            {/* Label Selection */}
            <div className="space-y-2">
              <Label>Selecionar Labels</Label>
              <div className="space-y-2 max-h-32 overflow-y-auto border rounded-md p-3">
                {labels.map(label => (
                  <div key={label.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`label-${label.id}`}
                      checked={selectedLabels.includes(label.id)}
                      onCheckedChange={() => toggleLabel(label.id)}
                    />
                    <LabelChip
                      label={label}
                      isSelected={selectedLabels.includes(label.id)}
                      onClick={() => toggleLabel(label.id)}
                      showCount={undefined}
                      size="sm"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Selected Labels Preview */}
            <div className="space-y-2">
              <Label>Labels Selecionadas</Label>
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
                        size="sm"
                      />
                    ) : null;
                  })
                ) : (
                  <p className="text-muted-foreground text-sm">Nenhuma label selecionada</p>
                )}
              </div>
            </div>

            {/* Cover Photo Selection */}
            {matchingPhotos.length > 0 && (
              <div className="space-y-2">
                <Label>Escolher Foto de Capa</Label>
                <div className="grid grid-cols-6 gap-2 p-2 border rounded-md max-h-32 overflow-y-auto">
                  <button
                    onClick={() => setSelectedCoverPhoto('')}
                    className={`aspect-square rounded border-2 transition-all flex items-center justify-center ${
                      selectedCoverPhoto === '' 
                        ? 'border-primary bg-primary/10' 
                        : 'border-border hover:border-muted-foreground bg-muted'
                    }`}
                  >
                    <span className="text-xs text-center">Sem capa</span>
                  </button>
                  {matchingPhotos.slice(0, 11).map(photo => (
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
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleUpdate} 
            disabled={!albumName.trim() || selectedLabels.length === 0 || isUpdating}
          >
            {isUpdating ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}