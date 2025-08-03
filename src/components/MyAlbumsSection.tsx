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
    <section className="p-6 border-b border-border animate-fade-in">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Folder className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-bold text-foreground">Meus Álbuns</h2>
          <span className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded-full">
            {albums.length}
          </span>
        </div>
        <p className="text-muted-foreground text-sm">
          Agrupe suas memórias em coleções temáticas
        </p>
      </div>

      {albums.length === 0 ? (
        <Card className="p-12 text-center bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <div className="text-7xl mb-6 opacity-80">📁</div>
          <h3 className="text-xl font-semibold text-foreground mb-3">
            Nenhum álbum criado
          </h3>
          <p className="text-muted-foreground mb-6 text-base">
            Comece criando álbuns para organizar melhor suas memórias
          </p>
          <Button onClick={onCreateAlbum} size="lg" className="gap-2 px-8 py-3 text-base shadow-lg hover:shadow-xl transition-all">
            <FolderPlus className="h-5 w-5" />
            Criar primeiro álbum
          </Button>
        </Card>
      ) : (
        <HorizontalCarousel>
          {albums.map((album, index) => (
            <div 
              key={album.id} 
              className="flex-shrink-0 animate-fade-in" 
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="group cursor-pointer hover:scale-105 transition-transform duration-200">
                <Card className="shadow-md hover:shadow-xl transition-all duration-300 border hover:border-primary/40">
                  <AlbumCard
                    album={album}
                    labels={labels}
                    onClick={() => onAlbumClick(album)}
                    onEdit={() => onEditAlbum(album)}
                    onDelete={() => onDeleteAlbum(album.id)}
                  />
                </Card>
              </div>
            </div>
          ))}
          
          {/* Create Album Button */}
          <div className="flex-shrink-0">
            <Card 
              className="w-64 h-48 border-2 border-dashed border-primary/30 hover:border-primary/60 hover:scale-105 transition-all duration-200 cursor-pointer group shadow-md hover:shadow-lg"
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