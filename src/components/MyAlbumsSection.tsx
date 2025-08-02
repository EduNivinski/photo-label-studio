import { FolderPlus, Folder } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { HorizontalCarousel } from './HorizontalCarousel';
import { AlbumCard } from './AlbumCard';
import type { Album } from '@/types/album';
import type { Label } from '@/types/photo';

interface MyAlbumsSectionProps {
  albums: Album[];
  labels: Label[];
  onCreateAlbum: () => void;
  onEditAlbum: (album: Album) => void;
  onDeleteAlbum: (albumId: string) => void;
  onAlbumClick: (album: Album) => void;
}

export function MyAlbumsSection({ 
  albums, 
  labels, 
  onCreateAlbum, 
  onEditAlbum, 
  onDeleteAlbum,
  onAlbumClick
}: MyAlbumsSectionProps) {
  return (
    <section className="p-6 border-b border-border">
      <div className="flex items-center gap-3 mb-4">
        <Folder className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Meus Álbuns</h2>
        <span className="text-sm text-muted-foreground">({albums.length})</span>
      </div>

      {albums.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="text-4xl mb-4">📁</div>
          <h3 className="text-lg font-medium text-foreground mb-2">
            Nenhum álbum criado
          </h3>
          <p className="text-muted-foreground mb-4">
            Organize suas fotos criando álbuns temáticos
          </p>
          <Button onClick={onCreateAlbum} className="gap-2">
            <FolderPlus className="h-4 w-4" />
            Criar primeiro álbum
          </Button>
        </Card>
      ) : (
        <HorizontalCarousel>
          {albums.map((album) => (
            <div key={album.id} className="flex-shrink-0">
              <AlbumCard
                album={album}
                labels={labels}
                onClick={() => onAlbumClick(album)}
                onEdit={() => onEditAlbum(album)}
                onDelete={() => onDeleteAlbum(album.id)}
              />
            </div>
          ))}
          
          {/* Create Album Button */}
          <div className="flex-shrink-0">
            <Card 
              className="w-64 h-48 border-2 border-dashed border-primary/30 hover:border-primary/60 transition-colors cursor-pointer group"
              onClick={onCreateAlbum}
            >
              <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <FolderPlus className="h-8 w-8 text-primary group-hover:scale-110 transition-transform mb-2" />
                <span className="text-sm font-medium text-foreground">Criar Álbum</span>
                <span className="text-xs text-muted-foreground">Organize suas fotos</span>
              </div>
            </Card>
          </div>
        </HorizontalCarousel>
      )}
    </section>
  );
}