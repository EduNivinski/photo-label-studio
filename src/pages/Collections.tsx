import { useState } from 'react';
import { FolderOpen, Plus, Edit, Trash2, Search, Archive } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAlbums } from '@/hooks/useAlbums';
import { useSupabaseData } from '@/hooks/useSupabaseData';
import { useToast } from '@/hooks/use-toast';
import { CreateAlbumDialog } from '@/components/CreateAlbumDialog';
import { EditAlbumDialog } from '@/components/EditAlbumDialog';
import type { Album } from '@/types/album';

export default function Collections() {
  const { albums, createAlbum, updateAlbum, deleteAlbum } = useAlbums();
  const { labels, photos } = useSupabaseData();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateAlbum, setShowCreateAlbum] = useState(false);
  const [showEditAlbum, setShowEditAlbum] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);

  // Filter collections based on search term
  const filteredCollections = albums.filter(album =>
    album.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get photo count for each collection
  const getCollectionPhotoCount = (album: Album) => {
    // This would need to be implemented to get photos from collection_photos table
    // For now, return 0 until we implement getAlbumPhotos properly  
    return 0;
  };

  const handleCreateAlbum = async (name: string, labelIds: string[], coverPhotoUrl?: string) => {
    try {
      await createAlbum(name, labelIds, coverPhotoUrl);
      toast({
        title: "Coleção criada com sucesso! 🎉",
        description: `A coleção "${name}" foi criada.`,
      });
      setShowCreateAlbum(false);
    } catch (error) {
      toast({
        title: "Erro ao criar coleção",
        description: "Ocorreu um erro ao criar a coleção. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleEditAlbum = (album: Album) => {
    setSelectedAlbum(album);
    setShowEditAlbum(true);
  };

  const handleUpdateAlbum = async (id: string, updates: Partial<Pick<Album, 'name' | 'cover_photo_url'>>) => {
    const success = await updateAlbum(id, updates);
    if (success) {
      toast({
        title: "Coleção atualizada com sucesso!",
        description: "As alterações foram salvas.",
      });
      setShowEditAlbum(false);
      setSelectedAlbum(null);
    } else {
      toast({
        title: "Erro ao atualizar coleção",
        description: "Ocorreu um erro ao salvar as alterações.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteAlbum = async (albumId: string) => {
    const album = albums.find(a => a.id === albumId);
    if (!album) return;

    const confirmed = confirm(`Tem certeza que deseja deletar a coleção "${album.name}"?`);
    if (!confirmed) return;

    const success = await deleteAlbum(albumId);
    if (success) {
      toast({
        title: "Coleção deletada com sucesso!",
        description: `A coleção "${album.name}" foi removida.`,
      });
    } else {
      toast({
        title: "Erro ao deletar coleção",
        description: "Ocorreu um erro ao deletar a coleção.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex-1 min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FolderOpen className="h-6 w-6 text-primary" />
              <div>
                <h1 className="text-2xl font-bold text-foreground">Minhas Coleções</h1>
                <p className="text-sm text-muted-foreground">
                  {albums.length} coleç{albums.length !== 1 ? 'ões' : 'ão'} criada{albums.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            <Button onClick={() => setShowCreateAlbum(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Criar Coleção
            </Button>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Search Bar */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar coleções..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Badge variant="secondary" className="text-sm">
            {filteredCollections.length} de {albums.length}
          </Badge>
        </div>

        {/* Collections Grid */}
        {filteredCollections.length === 0 ? (
          <Card className="p-12 text-center">
            {albums.length === 0 ? (
              <>
                <div className="text-7xl mb-6 opacity-80">📁</div>
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  Nenhuma coleção criada
                </h3>
                <p className="text-muted-foreground mb-6 text-base">
                  Comece criando coleções para organizar melhor suas memórias
                </p>
                <Button onClick={() => setShowCreateAlbum(true)} size="lg" className="gap-2">
                  <Plus className="h-5 w-5" />
                  Criar primeira coleção
                </Button>
              </>
            ) : (
              <>
                <div className="text-7xl mb-6 opacity-80">🔍</div>
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  Nenhuma coleção encontrada
                </h3>
                <p className="text-muted-foreground text-base">
                  Tente buscar por outro termo
                </p>
              </>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredCollections.map((album, index) => {
              const photoCount = getCollectionPhotoCount(album);
              
              return (
                <Card 
                  key={album.id} 
                  className="group overflow-hidden hover:shadow-xl transition-all duration-300 animate-fade-in cursor-pointer"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <Link 
                    to={`/collections/${album.id}`}
                    className="block"
                  >
                    {/* Cover Photo */}
                    <div className="relative h-48 overflow-hidden">
                      {album.cover_photo_url ? (
                        <>
                          <img 
                            src={album.cover_photo_url} 
                            alt={album.name}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                        </>
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/10 to-primary/20 flex items-center justify-center">
                          <Archive className="h-12 w-12 text-primary/60" />
                        </div>
                      )}
                      
                      {/* Action Buttons Overlay */}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleEditAlbum(album);
                            }}
                            className="h-8 w-8 p-0 bg-white/90 hover:bg-white"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDeleteAlbum(album.id);
                            }}
                            className="h-8 w-8 p-0"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      {/* Title Overlay */}
                      <div className="absolute bottom-4 left-4 right-4">
                        <h3 className="text-white font-bold text-lg drop-shadow-lg line-clamp-2">
                          {album.name}
                        </h3>
                      </div>
                    </div>
                  </Link>

                  {/* Collection Info */}
                  <div className="p-4 bg-card">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {photoCount} foto{photoCount !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                      
                      <span className="text-xs text-muted-foreground">
                        {new Date(album.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <CreateAlbumDialog
        open={showCreateAlbum}
        onOpenChange={setShowCreateAlbum}
        onCreate={(name, photoIds) => handleCreateAlbum(name, [], undefined)}
      />

      <EditAlbumDialog
        open={showEditAlbum}
        onOpenChange={(open) => {
          setShowEditAlbum(open);
          if (!open) setSelectedAlbum(null);
        }}
        onUpdate={handleUpdateAlbum}
        album={selectedAlbum}
      />
    </div>
  );
}