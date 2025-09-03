import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAlbums } from '@/hooks/useAlbums';
import type { Album } from '@/types/album';

interface EditAlbumDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  album: Album | null;
  onUpdate: (id: string, updates: Partial<Pick<Album, 'name' | 'cover_photo_url'>>) => Promise<void>;
}

export function EditAlbumDialog({
  open,
  onOpenChange,
  album,
  onUpdate
}: EditAlbumDialogProps) {
  const [albumName, setAlbumName] = useState('');
  const [selectedCoverPhoto, setSelectedCoverPhoto] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [albumPhotos, setAlbumPhotos] = useState<any[]>([]);
  const { getAlbumPhotos } = useAlbums();

  useEffect(() => {
    if (album) {
      setAlbumName(album.name);
      setSelectedCoverPhoto(album.cover_photo_url || '');
      
      // Fetch album photos
      getAlbumPhotos(album.id).then(photos => {
        setAlbumPhotos(photos);
      });
    }
  }, [album, getAlbumPhotos]);

  const handleUpdate = async () => {
    if (!album || !albumName.trim()) return;

    setIsUpdating(true);
    try {
      await onUpdate(album.id, {
        name: albumName,
        cover_photo_url: selectedCoverPhoto || undefined
      });
      onOpenChange(false);
    } finally {
      setIsUpdating(false);
    }
  };

  if (!album) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Editar Coleção</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 flex-1 overflow-y-auto">
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

          {/* Cover Photo Selection */}
          {albumPhotos.length > 0 && (
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
                {albumPhotos.slice(0, 11).map(photo => (
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

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleUpdate} 
            disabled={!albumName.trim() || isUpdating}
          >
            {isUpdating ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}