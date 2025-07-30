import { useState } from 'react';
import { Tag, Plus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LabelChip } from './LabelChip';
import { QuickLabelSelector } from './QuickLabelSelector';
import type { Photo, Label } from '@/types/photo';

interface PhotoCardProps {
  photo: Photo;
  labels: Label[];
  isSelected?: boolean;
  onClick: () => void;
  onLabelManage: () => void;
  onSelectionToggle: (isShiftPressed: boolean) => void;
  onUpdateLabels: (photoId: string, labelIds: string[]) => void;
}

export function PhotoCard({ 
  photo, 
  labels, 
  isSelected = false,
  onClick, 
  onLabelManage,
  onSelectionToggle,
  onUpdateLabels
}: PhotoCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  
  const photoLabels = labels.filter(label => photo.labels.includes(label.id));

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger on checkbox, buttons, or other interactive elements
    const target = e.target as HTMLElement;
    if (target.closest('input, button, [role="button"]')) return;
    onClick();
  };

  const handleCheckboxChange = () => {
    onSelectionToggle(false);
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectionToggle(e.shiftKey);
  };

  const handleAddLabel = (labelId: string) => {
    const newLabels = [...photo.labels, labelId];
    onUpdateLabels(photo.id, newLabels);
  };

  const handleRemoveLabel = (labelId: string) => {
    const newLabels = photo.labels.filter(id => id !== labelId);
    onUpdateLabels(photo.id, newLabels);
  };

  return (
    <Card 
      className={`group overflow-hidden transition-all duration-200 hover:shadow-lg cursor-pointer ${
        isSelected 
          ? 'ring-2 ring-primary ring-offset-2 border-primary shadow-lg' 
          : 'border-photo-border hover:border-primary'
      }`}
      onClick={handleCardClick}
    >
      <div className="relative aspect-square">
        {/* Selection Checkbox */}
        <div className="absolute top-2 left-2 z-10">
          <div 
            className={`w-5 h-5 rounded border-2 cursor-pointer transition-all duration-200 flex items-center justify-center ${
              isSelected 
                ? 'bg-primary border-primary text-primary-foreground' 
                : 'bg-background/80 backdrop-blur-sm border-white/60 hover:border-primary'
            }`}
            onClick={handleCheckboxClick}
          >
            {isSelected && (
              <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </div>
        </div>

        <img
          src={photo.url}
          alt={photo.name}
          className={`w-full h-full object-cover transition-all duration-300 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          } group-hover:scale-105`}
          onLoad={() => setImageLoaded(true)}
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
          {photoLabels.map((label) => (
            <LabelChip 
              key={label.id} 
              label={label} 
              variant="tag" 
              onRemove={() => handleRemoveLabel(label.id)}
            />
          ))}
          
          {/* Botão para adicionar nova label */}
          <QuickLabelSelector
            labels={labels}
            photoLabels={photo.labels}
            onAddLabel={handleAddLabel}
          >
            <Button
              size="sm"
              variant="ghost"
              className="h-5 w-5 p-0 rounded-full text-muted-foreground hover:text-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </QuickLabelSelector>
        </div>
        
        <div className="text-xs text-muted-foreground">
          {new Date(photo.uploadDate).toLocaleDateString('pt-BR')}
        </div>
      </div>
    </Card>
  );
}