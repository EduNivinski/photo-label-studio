import React from 'react';
import { Album } from '@/types/album';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { X, FolderOpen } from 'lucide-react';

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
    <div className="bg-card border border-border rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Coleções (Projetos)</h3>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
            {collections.length}
          </span>
        </div>
        
        {selectedCollectionId && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Filtros aplicam-se apenas dentro desta coleção</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCollectionChange(null)}
              className="h-6 w-6 p-0"
            >
              <X size={12} />
            </Button>
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground min-w-fit">Selecionar projeto:</span>
        <Select value={selectedCollectionId || "all"} onValueChange={(value) => onCollectionChange(value === "all" ? null : value)}>
          <SelectTrigger className="flex-1 max-w-xs bg-background">
            <SelectValue placeholder="Todas as fotos" />
          </SelectTrigger>
          <SelectContent className="bg-background border border-border">
            <SelectItem value="all" className="font-medium">
              📂 Todas as fotos
            </SelectItem>
            {collections.map((collection) => (
              <SelectItem key={collection.id} value={collection.id}>
                🗂️ {collection.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {!selectedCollectionId && (
          <span className="text-xs text-muted-foreground">
            Labels funcionam em todas as fotos
          </span>
        )}
      </div>
    </div>
  );
}