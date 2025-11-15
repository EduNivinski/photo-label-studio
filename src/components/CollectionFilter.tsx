import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { X, FolderOpen, Search, Folder, Cloud, Trash2 } from 'lucide-react';
import { UnifiedCollection } from '@/hooks/useUnifiedCollections';

interface CollectionFilterProps {
  collections: UnifiedCollection[];
  selectedCollectionId: string | null;
  onCollectionChange: (collectionId: string | null) => void;
}

export function CollectionFilter({ 
  collections, 
  selectedCollectionId, 
  onCollectionChange 
}: CollectionFilterProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const filteredCollections = useMemo(() => {
    if (!searchTerm) return collections;
    return collections.filter(collection => 
      collection.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [collections, searchTerm]);

  const manualCollections = useMemo(() => 
    filteredCollections.filter(c => c.type === 'manual'),
    [filteredCollections]
  );

  const driveCollections = useMemo(() => 
    filteredCollections.filter(c => c.type === 'drive'),
    [filteredCollections]
  );

  const orphanCollection = useMemo(() => 
    filteredCollections.find(c => c.type === 'orphans'),
    [filteredCollections]
  );

  const selectedCollection = collections.find(c => c.id === selectedCollectionId);

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
        <span className="text-sm text-muted-foreground min-w-fit">Selecionar coleção:</span>
        
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button 
              variant="outline" 
              className="flex-1 max-w-xs justify-start text-left font-normal h-10"
              onClick={() => setIsOpen(!isOpen)}
            >
              <Search className="mr-2 h-4 w-4 text-muted-foreground" />
              {selectedCollection ? selectedCollection.name : "Todos os arquivos"}
            </Button>
          </PopoverTrigger>
          
          <PopoverContent 
            className="p-0 w-80 z-50 bg-background border border-border" 
            align="start"
            onOpenAutoFocus={(e) => e.preventDefault()}
            sideOffset={4}
          >
            <Command className="bg-background">
              <CommandInput 
                placeholder="Buscar coleções..." 
                value={searchTerm}
                onValueChange={setSearchTerm}
                className="bg-background"
              />
              <CommandList className="bg-background">
                <CommandEmpty>Nenhuma coleção encontrada.</CommandEmpty>
                
                {/* Todos os arquivos */}
                <CommandGroup className="bg-background">
                  <CommandItem
                    onSelect={() => {
                      onCollectionChange(null);
                      setSearchTerm('');
                      setIsOpen(false);
                    }}
                    className="flex items-center gap-2 cursor-pointer bg-background hover:bg-accent"
                  >
                    <Folder className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Todos os arquivos</span>
                  </CommandItem>
                </CommandGroup>

                {/* Collections Manuais */}
                {manualCollections.length > 0 && (
                  <CommandGroup heading="Collections Manuais" className="bg-background">
                    {manualCollections.map((collection) => (
                      <CommandItem
                        key={collection.id}
                        onSelect={() => {
                          onCollectionChange(collection.id);
                          setSearchTerm('');
                          setIsOpen(false);
                        }}
                        className="flex items-center gap-2 cursor-pointer bg-background hover:bg-accent"
                      >
                        <FolderOpen className="h-4 w-4 text-primary" />
                        <span className="flex-1">{collection.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          📁 {collection.count}
                        </Badge>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {/* Pastas do Drive */}
                {driveCollections.length > 0 && (
                  <CommandGroup heading="Pastas do Drive" className="bg-background">
                    {driveCollections.map((collection) => (
                      <CommandItem
                        key={collection.id}
                        onSelect={() => {
                          onCollectionChange(collection.id);
                          setSearchTerm('');
                          setIsOpen(false);
                        }}
                        className="flex items-center gap-2 cursor-pointer bg-background hover:bg-accent"
                      >
                        <Cloud className="h-4 w-4 text-blue-500" />
                        <span className="flex-1">{collection.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          ☁️ {collection.count}
                        </Badge>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {/* Arquivos Órfãos */}
                {orphanCollection && (
                  <CommandGroup heading="Lixeira Virtual" className="bg-background">
                    <CommandItem
                      key={orphanCollection.id}
                      onSelect={() => {
                        onCollectionChange(orphanCollection.id);
                        setSearchTerm('');
                        setIsOpen(false);
                      }}
                      className="flex items-center gap-2 cursor-pointer bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                      <span className="flex-1 font-medium text-red-700 dark:text-red-400">{orphanCollection.name}</span>
                      <Badge variant="destructive" className="text-xs">
                        {orphanCollection.count}
                      </Badge>
                    </CommandItem>
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}