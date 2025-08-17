import { useState } from 'react';
import { Tag, Plus, Play, Heart, ChevronDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { LabelChip } from './LabelChip';
import { QuickLabelSelector } from './QuickLabelSelector';
import { getFileType } from '@/lib/fileUtils';
import type { Photo, Label } from '@/types/photo';

interface PhotoCardProps {
  photo: Photo;
  labels: Label[];
  isSelected?: boolean;
  hasActiveSelections?: boolean; // NEW: indica se há itens selecionados (modo seleção múltipla)
  onClick: () => void;
  onLabelManage: () => void;
  onSelectionToggle: (isShiftPressed: boolean) => void;
  onUpdateLabels: (photoId: string, labelIds: string[]) => void;
}

export function PhotoCard({ 
  photo, 
  labels, 
  isSelected = false,
  hasActiveSelections = false,
  onClick, 
  onLabelManage,
  onSelectionToggle,
  onUpdateLabels
}: PhotoCardProps) {
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  
  const photoLabels = labels.filter(label => photo.labels.includes(label.id) && label.name !== 'favorites');
  const isVideo = getFileType(photo.url) === 'video';
  const isFavorite = photo.labels.includes('favorites');

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger on checkbox, buttons, or other interactive elements
    const target = e.target as HTMLElement;
    if (target.closest('input, button, [role="button"], [data-radix-popper-content-wrapper]')) return;
    
    // Se há seleções ativas (modo seleção múltipla), clicar na foto alterna a seleção
    if (hasActiveSelections) {
      onSelectionToggle(e.shiftKey);
    } else {
      // Caso contrário, abre o modal da foto
      onClick();
    }
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

  const handleToggleFavorite = async () => {
    const newLabels = isFavorite 
      ? photo.labels.filter(id => id !== 'favorites')
      : [...photo.labels, 'favorites'];
    
    // Update immediately for visual feedback
    await onUpdateLabels(photo.id, newLabels);
  };

  return (
    <div 
      className="media-card group overflow-hidden cursor-pointer relative border border-photo-border hover:border-primary/30 hover:shadow-lg transition-all duration-300 rounded-sm" 
      onClick={handleCardClick}
      style={{ aspectRatio: '1 / 1' }}
    >
      {/* Selection Checkbox */}
      <div className={`absolute top-2 left-2 z-10 transition-opacity duration-200 ${
        hasActiveSelections || isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
      }`}>
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

      {isVideo ? (
        <>
          <video
            src={photo.url}
            className={`w-full h-full object-cover transition-all duration-500 ${
              mediaLoaded ? 'opacity-100' : 'opacity-0'
            } group-hover:scale-110`}
            onLoadedData={() => setMediaLoaded(true)}
            onError={() => setMediaError(true)}
            muted
            preload="metadata"
          />
          {/* Play button overlay for videos */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-black/70 rounded-full p-4 backdrop-blur-sm">
              <Play className="h-8 w-8 text-white fill-white" />
            </div>
          </div>
        </>
      ) : (
        <img
          src={photo.url}
          alt={photo.name}
          className={`w-full h-full object-cover transition-all duration-500 ${
            mediaLoaded ? 'opacity-100' : 'opacity-0'
          } group-hover:scale-110`}
          onLoad={() => setMediaLoaded(true)}
          onError={() => setMediaError(true)}
        />
      )}
      
      {!mediaLoaded && !mediaError && (
        <div className="absolute inset-0 bg-photo-background animate-pulse" />
      )}
      
      {mediaError && (
        <div className="absolute inset-0 bg-photo-background flex items-center justify-center">
          <div className="text-center">
            <div className="text-2xl mb-2">⚠️</div>
            <p className="text-sm text-muted-foreground">Erro ao carregar</p>
          </div>
        </div>
      )}
      
      {/* Gradient overlay for content integration */}
      <div className="card-overlay absolute bottom-0 w-full">
        <div className="labels space-y-1 mb-2">
          {/* Primeira linha de labels (sempre fixa) */}
          <div className="flex flex-wrap gap-1 h-6 overflow-hidden">
            {photoLabels.slice(0, 3).map((label) => (
              <LabelChip 
                key={label.id} 
                label={label} 
                variant="card" 
                onRemove={() => handleRemoveLabel(label.id)}
                className="bg-white/20 backdrop-blur-sm text-white border-white/30 hover:bg-white/30 text-xs flex-shrink-0"
                size="sm"
              />
            ))}
            
            {/* Botão para adicionar nova label na primeira linha */}
            {!isSelected && photoLabels.length < 3 && (
              <div className={`transition-opacity duration-200 flex-shrink-0 ${
                hasActiveSelections || isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}>
                <QuickLabelSelector
                  labels={labels}
                  photoLabels={photo.labels}
                  onAddLabel={handleAddLabel}
                >
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 rounded-full text-white/80 hover:text-white hover:bg-white/20 flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </QuickLabelSelector>
              </div>
            )}
          </div>
          
          {/* Segunda linha de labels (se houver mais de 3) */}
          {photoLabels.length > 3 && (
            <div className="flex flex-wrap gap-1 h-6 overflow-hidden">
              {photoLabels.slice(3, 6).map((label) => (
                <LabelChip 
                  key={label.id} 
                  label={label} 
                  variant="card" 
                  onRemove={() => handleRemoveLabel(label.id)}
                  className="bg-white/20 backdrop-blur-sm text-white border-white/30 hover:bg-white/30 text-xs flex-shrink-0"
                  size="sm"
                />
              ))}
              
              {/* Botão de "mais" se houver mais de 6 labels */}
              {photoLabels.length > 6 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button 
                      className="text-xs text-white/90 bg-white/25 backdrop-blur-sm px-2 py-1 rounded-full hover:bg-white/35 transition-colors flex items-center gap-1 flex-shrink-0 h-6"
                      onClick={(e) => e.stopPropagation()}
                      title={`${photoLabels.length} labels no total`}
                    >
                      <span className="text-xs">⋯</span>
                      <span className="text-xs font-medium">{photoLabels.length}</span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-2" align="start">
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-muted-foreground mb-2">
                        Todas as labels:
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {photoLabels.map((label) => (
                          <LabelChip 
                            key={label.id}
                            label={label}
                            variant="tag"
                            onRemove={() => handleRemoveLabel(label.id)}
                            size="sm"
                          />
                        ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
              
              {/* Botão para adicionar nova label na segunda linha */}
              {!isSelected && photoLabels.length >= 3 && photoLabels.length < 6 && (
                <div className={`transition-opacity duration-200 flex-shrink-0 ${
                  hasActiveSelections || isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}>
                  <QuickLabelSelector
                    labels={labels}
                    photoLabels={photo.labels}
                    onAddLabel={handleAddLabel}
                  >
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 rounded-full text-white/80 hover:text-white hover:bg-white/20 flex-shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </QuickLabelSelector>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-end">          
          {/* Favorite button */}
          <div className={`transition-opacity duration-200 ${
            hasActiveSelections || isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 rounded-full text-white hover:text-white hover:bg-black/30 bg-black/20 backdrop-blur-sm relative z-10"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleFavorite();
              }}
            >
              <Heart className={`h-6 w-6 transition-colors ${
                isFavorite 
                  ? 'fill-red-500 text-red-500 drop-shadow-lg' 
                  : 'text-white/90 hover:text-red-400'
              }`} />
            </Button>
          </div>
        </div>
      </div>

      {/* Action button overlay */}
      {!isSelected && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <Button
            size="sm"
            variant="secondary"
            className="h-8 w-8 p-0 bg-white/90 hover:bg-white backdrop-blur-sm"
            onClick={(e) => {
              e.stopPropagation();
              onLabelManage();
            }}
          >
            <Tag className="h-4 w-4" />
          </Button>
        </div>
      )}

      {isSelected && (
        <div className="absolute inset-0 ring-2 ring-primary ring-offset-2 border-primary shadow-lg pointer-events-none" />
      )}
    </div>
  );
}