import { useState } from 'react';
import { MoreHorizontal, Tag } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LabelChip } from './LabelChip';
import type { Photo, Label } from '@/types/photo';

interface PhotoCardProps {
  photo: Photo;
  labels: Label[];
  onClick: () => void;
  onLabelManage: () => void;
}

export function PhotoCard({ photo, labels, onClick, onLabelManage }: PhotoCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  
  const photoLabels = labels.filter(label => photo.labels.includes(label.id));

  return (
    <Card className="group overflow-hidden border-photo-border hover:border-primary transition-all duration-200 hover:shadow-lg">
      <div className="relative aspect-square">
        <img
          src={photo.url}
          alt={photo.name}
          className={`w-full h-full object-cover cursor-pointer transition-all duration-300 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          } group-hover:scale-105`}
          onLoad={() => setImageLoaded(true)}
          onClick={onClick}
        />
        {!imageLoaded && (
          <div className="absolute inset-0 bg-photo-background animate-pulse" />
        )}
        
        {/* Overlay com ações */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200" />
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <Button
            size="sm"
            variant="secondary"
            className="h-8 w-8 p-0 bg-white/90 hover:bg-white"
            onClick={(e) => {
              e.stopPropagation();
              onLabelManage();
            }}
          >
            <Tag className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div className="p-3">
        <h3 className="font-medium text-sm truncate text-card-foreground mb-2">
          {photo.name}
        </h3>
        
        <div className="flex flex-wrap gap-1 mb-2 min-h-[20px]">
          {photoLabels.slice(0, 3).map((label) => (
            <LabelChip key={label.id} label={label} variant="tag" />
          ))}
          {photoLabels.length > 3 && (
            <span className="text-xs text-muted-foreground self-center">
              +{photoLabels.length - 3}
            </span>
          )}
        </div>
        
        <div className="text-xs text-muted-foreground">
          {new Date(photo.uploadDate).toLocaleDateString('pt-BR')}
        </div>
      </div>
    </Card>
  );
}