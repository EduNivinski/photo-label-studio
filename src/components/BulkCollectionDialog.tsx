import { useState } from 'react';
import { Plus, X, Loader2 } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface BulkCollectionDialogProps {
  open: boolean;
  onClose: () => void;
  selectedCount: number;
  onManageCollections: (action: 'add' | 'remove', collections: string[]) => Promise<void>;
}

export function BulkCollectionDialog({
  open,
  onClose,
  selectedCount,
  onManageCollections,
}: BulkCollectionDialogProps) {
  const [collectionsToAdd, setCollectionsToAdd] = useState<string[]>([]);
  const [collectionsToRemove, setCollectionsToRemove] = useState<string[]>([]);
  const [newCollection, setNewCollection] = useState('');
  const [isApplying, setIsApplying] = useState(false);

  const handleAddCollection = () => {
    if (newCollection.trim() && !collectionsToAdd.includes(newCollection.trim())) {
      setCollectionsToAdd([...collectionsToAdd, newCollection.trim()]);
      setNewCollection('');
    }
  };

  const handleRemoveFromAdd = (collection: string) => {
    setCollectionsToAdd(collectionsToAdd.filter(c => c !== collection));
  };

  const handleMarkForRemoval = (collection: string) => {
    if (!collectionsToRemove.includes(collection)) {
      setCollectionsToRemove([...collectionsToRemove, collection]);
    }
  };

  const handleUnmarkForRemoval = (collection: string) => {
    setCollectionsToRemove(collectionsToRemove.filter(c => c !== collection));
  };

  const handleApply = async () => {
    setIsApplying(true);
    try {
      if (collectionsToAdd.length > 0) {
        await onManageCollections('add', collectionsToAdd);
      }
      if (collectionsToRemove.length > 0) {
        await onManageCollections('remove', collectionsToRemove);
      }
      handleClose();
    } finally {
      setIsApplying(false);
    }
  };

  const handleClose = () => {
    if (!isApplying) {
      setCollectionsToAdd([]);
      setCollectionsToRemove([]);
      setNewCollection('');
      onClose();
    }
  };

  const hasChanges = collectionsToAdd.length > 0 || collectionsToRemove.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gerenciar Collections</DialogTitle>
          <DialogDescription>
            Adicionar ou remover collections de {selectedCount} {selectedCount === 1 ? 'item selecionado' : 'itens selecionados'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Add collections */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Adicionar Collections</label>
            <div className="flex gap-2">
              <Input
                value={newCollection}
                onChange={(e) => setNewCollection(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCollection();
                  }
                }}
                placeholder="Nome da collection"
                disabled={isApplying}
              />
              <Button
                size="sm"
                onClick={handleAddCollection}
                disabled={!newCollection.trim() || isApplying}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {collectionsToAdd.length > 0 && (
              <ScrollArea className="h-24 border rounded-md p-2">
                <div className="flex flex-wrap gap-2">
                  {collectionsToAdd.map((collection) => (
                    <Badge
                      key={collection}
                      variant="secondary"
                      className="gap-1"
                    >
                      {collection}
                      <button
                        onClick={() => handleRemoveFromAdd(collection)}
                        className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                        disabled={isApplying}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Remove collections */}
          {collectionsToRemove.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-destructive">
                Remover Collections
              </label>
              <ScrollArea className="h-24 border border-destructive/20 rounded-md p-2">
                <div className="flex flex-wrap gap-2">
                  {collectionsToRemove.map((collection) => (
                    <Badge
                      key={collection}
                      variant="destructive"
                      className="gap-1"
                    >
                      {collection}
                      <button
                        onClick={() => handleUnmarkForRemoval(collection)}
                        className="ml-1 hover:bg-background/20 rounded-full p-0.5"
                        disabled={isApplying}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isApplying}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleApply}
            disabled={!hasChanges || isApplying}
          >
            {isApplying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}