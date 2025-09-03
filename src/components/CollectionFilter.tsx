import React from 'react';
import { Album } from '@/types/album';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface CollectionFilterProps {
  collections: Album[];
  selectedCollectionId: string | null;
  onCollectionChange: (collectionId: string | null) => void;
}

export function CollectionFilter({ 
  collections, 
  selectedCollectionId, 
  onCollectionChange 
}: CollectionFilterProps) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-sm font-medium text-foreground">Coleção:</span>
      <Select value={selectedCollectionId || ""} onValueChange={(value) => onCollectionChange(value || null)}>
        <SelectTrigger className="w-60">
          <SelectValue placeholder="Todas as fotos" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Todas as fotos</SelectItem>
          {collections.map((collection) => (
            <SelectItem key={collection.id} value={collection.id}>
              {collection.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {selectedCollectionId && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onCollectionChange(null)}
          className="h-8 w-8 p-0"
        >
          <X size={14} />
        </Button>
      )}
    </div>
  );
}