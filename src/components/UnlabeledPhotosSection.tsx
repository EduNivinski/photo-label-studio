import { AlertTriangle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { HorizontalCarousel } from './HorizontalCarousel';
import { getFileType } from '@/lib/fileUtils';
import type { Photo } from '@/types/photo';

interface UnlabeledPhotosSectionProps {
  photos: Photo[];
  onViewAll: () => void;
}

export function UnlabeledPhotosSection({ photos, onViewAll }: UnlabeledPhotosSectionProps) {
  const unlabeledPhotos = photos.filter(photo => photo.labels.length === 0);

  if (unlabeledPhotos.length === 0) {
    return (
      <section className="p-6 border-b border-border">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="h-5 w-5 text-green-500" />
          <h2 className="text-lg font-semibold text-foreground">Fotos para Organizar</h2>
          <Badge variant="secondary" className="bg-green-100 text-green-700">
            ✓ Todas organizadas
          </Badge>
        </div>
        
        <Card className="p-6 text-center">
          <div className="text-4xl mb-3">🎉</div>
          <h3 className="text-lg font-medium text-foreground mb-2">
            Parabéns! Todas as fotos estão organizadas
          </h3>
          <p className="text-muted-foreground">
            Todas as suas fotos já possuem labels
          </p>
        </Card>
      </section>
    );
  }

  return (
    <section className="p-6 border-b border-border">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          <h2 className="text-lg font-semibold text-foreground">Fotos para Organizar</h2>
          <Badge variant="secondary" className="bg-orange-100 text-orange-700">
            {unlabeledPhotos.length} pendente{unlabeledPhotos.length !== 1 ? 's' : ''}
          </Badge>
        </div>
        
        <Button variant="outline" size="sm" onClick={onViewAll} className="gap-2">
          Ver todas
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      <HorizontalCarousel>
        {unlabeledPhotos.slice(0, 20).map((photo) => {
          const isVideo = getFileType(photo.url) === 'video';
          
          return (
            <div key={photo.id} className="flex-shrink-0">
              <Card className="overflow-hidden w-32 h-32 group cursor-pointer hover:shadow-lg transition-shadow">
                <div className="relative w-full h-full">
                  {isVideo ? (
                    <>
                      <video
                        src={photo.url}
                        className="w-full h-full object-cover"
                        muted
                        preload="metadata"
                      />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="bg-black/60 rounded-full p-1">
                          <svg className="h-3 w-3 text-white fill-white" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z"/>
                          </svg>
                        </div>
                      </div>
                    </>
                  ) : (
                    <img
                      src={photo.url}
                      alt={photo.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  )}
                  
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                </div>
              </Card>
            </div>
          );
        })}
        
        {unlabeledPhotos.length > 20 && (
          <div className="flex-shrink-0">
            <Card 
              className="w-32 h-32 border-2 border-dashed border-muted-foreground/30 hover:border-primary/60 transition-colors cursor-pointer group"
              onClick={onViewAll}
            >
              <div className="flex flex-col items-center justify-center h-full text-center">
                <span className="text-lg font-bold text-muted-foreground group-hover:text-primary">
                  +{unlabeledPhotos.length - 20}
                </span>
                <span className="text-xs text-muted-foreground">mais fotos</span>
              </div>
            </Card>
          </div>
        )}
      </HorizontalCarousel>
    </section>
  );
}