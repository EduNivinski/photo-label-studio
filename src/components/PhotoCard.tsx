import { useState } from 'react';
import { Tag, Plus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
    if (e.target instanceof HTMLInputElement) return; // Don't trigger on checkbox click
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
      className={`group overflow-hidden border-photo-border hover:border-primary transition-all duration-200 hover:shadow-lg cursor-pointer ${
        isSelected ? 'ring-2 ring-primary ring-offset-2' : ''
      }`}
      onClick={handleCardClick}
    >
      <div className="relative aspect-square">
        {/* Selection Checkbox */}
        <div className="absolute top-2 left-2 z-10">
          <Checkbox
            checked={isSelected}
            onCheckedChange={handleCheckboxChange}
            onClick={handleCheckboxClick}
            className="bg-background/80 backdrop-blur-sm border-2"
          />
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