import { useState, useEffect } from 'react';
import { MoreVertical, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAlbums } from '@/hooks/useAlbums';
import type { Album } from '@/types/album';

interface AlbumCardProps {
  album: Album;
  photoCount?: number;
  onEdit: (album: Album) => void;
  onDelete: (albumId: string) => void;
}

export function AlbumCard({ album, photoCount = 0, onEdit, onDelete }: AlbumCardProps) {
  const [imageError, setImageError] = useState(false);
  const [actualPhotoCount, setActualPhotoCount] = useState(photoCount);
  const { getAlbumPhotos } = useAlbums();

  useEffect(() => {
    const fetchPhotoCount = async () => {
      const photos = await getAlbumPhotos(album.id);
      setActualPhotoCount(photos.length);
    };

    if (photoCount === 0) {
      fetchPhotoCount();
    }
  }, [album.id, photoCount, getAlbumPhotos]);

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(album);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(album.id);
  };

  return (
    <Card className="group cursor-pointer hover:shadow-md transition-all border border-border bg-card">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1">
              {album.name}
            </h3>
            <span className="text-xs text-muted-foreground">
              {actualPhotoCount} {actualPhotoCount === 1 ? 'foto' : 'fotos'}
            </span>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={handleMenuClick}>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleEdit}>
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Cover Image with Gradient Overlay */}
        <div className="relative aspect-video bg-muted rounded-lg mb-3 overflow-hidden">
          {album.cover_photo_url && !imageError ? (
            <>
              <img
                src={album.cover_photo_url}
                alt={album.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                onError={() => setImageError(true)}
              />
              {/* Gradient overlay */}
              <div className="absolute bottom-0 left-0 right-0 h-[40%] bg-gradient-to-t from-black/70 via-black/30 to-transparent group-hover:from-black/80 group-hover:via-black/40 transition-all duration-300" />
              
              {/* Collection info overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                <h4 className="font-medium text-sm truncate drop-shadow-sm mb-1">
                  {album.name}
                </h4>
                <div className="text-xs text-white/80 drop-shadow-sm">
                  {actualPhotoCount} {actualPhotoCount === 1 ? 'foto' : 'fotos'}
                </div>
              </div>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <div className="text-2xl mb-1">📸</div>
                <div className="text-sm">{actualPhotoCount} {actualPhotoCount === 1 ? 'foto' : 'fotos'}</div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}