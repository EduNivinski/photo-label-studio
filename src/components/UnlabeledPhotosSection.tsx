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
      <section className="p-6 border-b border-border animate-fade-in">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="h-6 w-6 text-green-600" />
            <h2 className="text-xl font-bold text-foreground">Fotos para Organizar</h2>
            <Badge className="bg-success-light text-success border-success-border">
              ✓ Todas organizadas
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            Veja rapidamente o que ainda precisa de labels
          </p>
        </div>
        
        <Card className="p-8 text-center bg-success-light border-success-border">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="text-6xl">🎉</div>
            <div className="w-12 h-12 bg-success text-white rounded-full flex items-center justify-center">
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <h3 className="text-xl font-semibold text-foreground mb-2">
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
    <section className="p-6 border-b border-border animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="h-6 w-6 text-orange-500" />
            <h2 className="text-xl font-bold text-foreground">Fotos para Organizar</h2>
            <Badge variant="secondary" className="bg-orange-100 text-orange-700">
              {unlabeledPhotos.length} pendente{unlabeledPhotos.length !== 1 ? 's' : ''}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            Veja rapidamente o que ainda precisa de labels
          </p>
        </div>
        
        <Button variant="outline" size="sm" onClick={onViewAll} className="gap-2 hover:bg-primary hover:text-primary-foreground transition-colors">
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