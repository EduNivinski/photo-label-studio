import { useState, useEffect } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ConvertFolderDialogProps {
  open: boolean;
  onClose: () => void;
  folderName: string;
  onConfirm: (collectionName: string) => Promise<void>;
}

export function ConvertFolderDialog({
  open,
  onClose,
  folderName,
  onConfirm,
}: ConvertFolderDialogProps) {
  const [collectionName, setCollectionName] = useState('');
  const [isConverting, setIsConverting] = useState(false);

  useEffect(() => {
    if (open && folderName) {
      setCollectionName(folderName);
    }
  }, [open, folderName]);

  const handleConfirm = async () => {
    if (!collectionName.trim()) return;

    setIsConverting(true);
    try {
      await onConfirm(collectionName.trim());
      onClose();
    } finally {
      setIsConverting(false);
    }
  };

  const handleClose = () => {
    if (!isConverting) {
      setCollectionName('');
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Converter Origem em Collection</DialogTitle>
          <DialogDescription>
            Todos os itens desta pasta de origem serão adicionados a uma nova collection editável.
            A pasta de origem continuará sendo atualizada automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground mb-1">Pasta de Origem</p>
              <p className="text-sm font-medium truncate">{folderName}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground mb-1">Nova Collection</p>
              <p className="text-sm font-medium truncate">{collectionName || '...'}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="collection-name">Nome da Collection</Label>
            <Input
              id="collection-name"
              value={collectionName}
              onChange={(e) => setCollectionName(e.target.value)}
              placeholder="Digite o nome da collection"
              disabled={isConverting}
            />
            <p className="text-xs text-muted-foreground">
              Você poderá editar esta collection manualmente após a conversão.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isConverting}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!collectionName.trim() || isConverting}
          >
            {isConverting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Converter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}