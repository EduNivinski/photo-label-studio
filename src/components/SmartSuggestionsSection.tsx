import { Bot, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { HorizontalCarousel } from './HorizontalCarousel';
import { LabelChip } from './LabelChip';
import type { Photo, Label } from '@/types/photo';

interface Cluster {
  labels: string[];
  photos: Photo[];
  coverPhoto?: Photo;
}

interface SmartSuggestionsSectionProps {
  photos: Photo[];
  labels: Label[];
  onClusterClick: (labelIds: string[]) => void;
}

export function SmartSuggestionsSection({ photos, labels, onClusterClick }: SmartSuggestionsSectionProps) {
  // Generate clusters from photos with multiple labels
  const generateClusters = (): Cluster[] => {
    const clusters: Map<string, Cluster> = new Map();
    
    photos.forEach(photo => {
      if (photo.labels.length >= 2) {
        // Sort labels to create consistent cluster keys
        const sortedLabels = [...photo.labels].sort();
        const key = sortedLabels.join(',');
        
        if (clusters.has(key)) {
          const cluster = clusters.get(key)!;
          cluster.photos.push(photo);
        } else {
          clusters.set(key, {
            labels: sortedLabels,
            photos: [photo],
            coverPhoto: photo
          });
        }
      }
    });
    
    // Filter clusters with at least 3 photos and sort by photo count
    return Array.from(clusters.values())
      .filter(cluster => cluster.photos.length >= 3)
      .sort((a, b) => b.photos.length - a.photos.length)
      .slice(0, 10); // Show max 10 clusters
  };

  const clusters = generateClusters();

  if (clusters.length === 0) {
    return (
      <section className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Bot className="h-5 w-5 text-blue-500" />
          <h2 className="text-lg font-semibold text-foreground">Sugestões Inteligentes</h2>
        </div>
        
        <Card className="p-6 text-center">
          <div className="text-4xl mb-3">🤖</div>
          <h3 className="text-lg font-medium text-foreground mb-2">
            Organize mais fotos para ver sugestões
          </h3>
          <p className="text-muted-foreground">
            Adicione labels às suas fotos para descobrir padrões automáticos
          </p>
        </Card>
      </section>
    );
  }

  return (
    <section className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <Bot className="h-5 w-5 text-blue-500" />
        <h2 className="text-lg font-semibold text-foreground">Sugestões Inteligentes</h2>
        <Badge variant="secondary" className="bg-blue-100 text-blue-700">
          {clusters.length} cluster{clusters.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      <HorizontalCarousel>
        {clusters.map((cluster, index) => {
          const clusterLabels = labels.filter(label => cluster.labels.includes(label.id));
          
          return (
            <div key={index} className="flex-shrink-0">
              <Card 
                className="w-64 overflow-hidden cursor-pointer hover:shadow-lg transition-shadow group"
                onClick={() => onClusterClick(cluster.labels)}
              >
                {/* Cover Photo */}
                <div className="relative h-32 overflow-hidden">
                  {cluster.coverPhoto && (
                    <img
                      src={cluster.coverPhoto.url}
                      alt="Cluster cover"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  
                  {/* Photo count badge */}
                  <Badge className="absolute top-2 right-2 bg-black/70 text-white">
                    {cluster.photos.length} foto{cluster.photos.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
                
                {/* Content */}
                <div className="p-4">
                  <div className="flex flex-wrap gap-1 mb-3">
                    {clusterLabels.map((label) => (
                      <LabelChip 
                        key={label.id} 
                        label={label} 
                        variant="tag" 
                        size="sm"
                      />
                    ))}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Cluster sugerido
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </div>
              </Card>
            </div>
          );
        })}
      </HorizontalCarousel>
    </section>
  );
}