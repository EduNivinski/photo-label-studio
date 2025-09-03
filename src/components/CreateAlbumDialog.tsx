import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSupabaseData } from '@/hooks/useSupabaseData';
import { usePhotoSelection } from '@/hooks/usePhotoSelection';
import type { Photo } from '@/types/photo';

interface CreateAlbumDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string, photoIds: string[]) => Promise<void>;
  selectedPhotos?: Photo[];
}

export function CreateAlbumDialog({
  open,
  onOpenChange,
  onCreate,
  selectedPhotos = []
}: CreateAlbumDialogProps) {
  const [albumName, setAlbumName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const { photos } = useSupabaseData();
  const { getSelectedPhotos } = usePhotoSelection();

  // Use selectedPhotos prop if provided, otherwise use global selection
  const photosToUse = selectedPhotos.length > 0 ? selectedPhotos : getSelectedPhotos(photos);

  // Calculate counts for photos and videos
  const mediaStats = useMemo(() => {
    const photos = photosToUse.filter(item => item.mediaType === 'photo').length;
    const videos = photosToUse.filter(item => item.mediaType === 'video').length;
    return { photos, videos, total: photos + videos };
  }, [photosToUse]);

  // Generate summary text
  const summaryText = useMemo(() => {
    const { photos, videos, total } = mediaStats;
    if (total === 0) return '';
    
    const parts = [];
    if (photos > 0) parts.push(`${photos} foto${photos !== 1 ? 's' : ''}`);
    if (videos > 0) parts.push(`${videos} vídeo${videos !== 1 ? 's' : ''}`);
    
    const itemsText = parts.join(' e ');
    return `${itemsText} será${total !== 1 ? 'ão' : ''} adicionada${total !== 1 ? 's' : ''} à coleção`;
  }, [mediaStats]);

  const handleCreate = async () => {
    if (!albumName.trim()) return;

    setIsCreating(true);
    try {
      const photoIds = photosToUse.map(photo => photo.id);
      await onCreate(albumName, photoIds);
      setAlbumName('');
      onOpenChange(false);
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setAlbumName('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar Coleção</DialogTitle>
        </DialogHeader>

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

          {/* Selected Media Summary */}
          <div className="space-y-2">
            <Label>Arquivos Selecionados</Label>
            <div className="text-sm text-muted-foreground">
              {summaryText}
            </div>
          </div>

          {photosToUse.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                Selecione alguns arquivos na página inicial antes de criar uma coleção.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
          <Button 
            onClick={handleCreate} 
            disabled={!albumName.trim() || isCreating}
          >
              {isCreating ? 'Criando...' : 'Criar Coleção'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}