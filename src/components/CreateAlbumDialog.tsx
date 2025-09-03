import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Play } from 'lucide-react';
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
  const [selectedCoverPhoto, setSelectedCoverPhoto] = useState<string>('');
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
      setSelectedCoverPhoto('');
      onOpenChange(false);
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setAlbumName('');
    setSelectedCoverPhoto('');
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

          {/* Cover Photo Selection */}
          {photosToUse.length > 0 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Escolher Foto de Capa (Opcional)</Label>
                <ScrollArea className="h-32">
                  <div className="grid grid-cols-6 gap-2 p-2">
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
                     {photosToUse.slice(0, 11).map(photo => (
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
                         {photo.mediaType === 'video' && (
                           <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                             <Play className="h-6 w-6 text-white" fill="white" />
                           </div>
                         )}
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