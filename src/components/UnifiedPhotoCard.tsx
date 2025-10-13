import { useState } from 'react';
import { Tag, Plus, Play, Heart, ChevronDown, ExternalLink } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { LabelChip } from './LabelChip';
import { QuickLabelSelector } from './QuickLabelSelector';
import { MediaThumb } from './MediaThumb';
import { MediaTypeHeader } from './MediaTypeHeader';
import { MediaItem } from '@/types/media';
import { formatDuration } from '@/lib/formatDuration';
import type { Label } from '@/types/photo';

interface UnifiedPhotoCardProps {
  item: MediaItem;
  labels: Label[];
  isSelected?: boolean;
  hasActiveSelections?: boolean;
  onClick: () => void;
  onLabelManage: () => void;
  onSelectionToggle: (isShiftPressed: boolean) => void;
  onUpdateLabels: (itemId: string, labelIds: string[]) => void;
}

export function UnifiedPhotoCard({ 
  item, 
  labels, 
  isSelected = false,
  hasActiveSelections = false,
  onClick, 
  onLabelManage,
  onSelectionToggle,
  onUpdateLabels
}: UnifiedPhotoCardProps) {
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  
  const itemLabels = labels.filter(label => 
    item.labels.some(itemLabel => itemLabel.id === label.id || itemLabel.name === label.name) && 
    label.name !== 'favorites'
  );
  const isFavorite = item.labels.some(label => label.name === 'favorites' || label.id === 'favorites');

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

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectionToggle(e.shiftKey);
  };

  const handleAddLabel = (labelId: string) => {
    const currentLabelIds = item.labels.map(l => l.id);
    const newLabels = [...currentLabelIds, labelId];
    onUpdateLabels(item.id, newLabels);
  };

  const handleRemoveLabel = (labelId: string) => {
    const currentLabelIds = item.labels.map(l => l.id);
    const newLabels = currentLabelIds.filter(id => id !== labelId);
    onUpdateLabels(item.id, newLabels);
  };

  const handleToggleFavorite = async () => {
    const currentLabelIds = item.labels.map(l => l.id);
    const newLabels = isFavorite 
      ? currentLabelIds.filter(id => id !== 'favorites')
      : [...currentLabelIds, 'favorites'];
    
    await onUpdateLabels(item.id, newLabels);
  };

  const handleOpenInDrive = () => {
    if (item.openInDriveUrl) {
      window.open(item.openInDriveUrl, '_blank');
    }
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

      <MediaThumb
        item={item}
        className={`transition-all duration-500 ${
          mediaLoaded ? 'opacity-100' : 'opacity-0'
        } group-hover:scale-110`}
        onLoad={() => setMediaLoaded(true)}
        onError={() => setMediaError(true)}
      />
      
      {item.isVideo && (
        <>
          {/* Play button overlay for videos */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-black/70 rounded-full p-4 backdrop-blur-sm">
              <Play className="h-8 w-8 text-white fill-white" />
            </div>
          </div>
          {/* Duration badge */}
          {item.durationMs && (
            <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
              {formatDuration(Math.floor(item.durationMs / 1000))}
            </div>
          )}
        </>
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
      <div className="card-overlay absolute bottom-0 w-full bg-gradient-to-t from-black/60 via-black/20 to-transparent p-3">
        {/* Media Type and Date Header - Always visible at top of card */}
        <div className="absolute top-[-4.5rem] left-3 right-3 bg-black/40 backdrop-blur-sm rounded px-2 py-1">
          <MediaTypeHeader
            mediaKind={item.mediaKind}
            mimeType={item.mimeType}
            originalTakenAt={item.originalTakenAt}
            createdAt={item.createdAt}
            className="text-white"
          />
        </div>

        <div className="labels mb-2 relative z-10 h-[3.25rem]">
          {/* Linha principal */}
          <div className="absolute bottom-7 left-0 right-0 h-6">
            <div className="flex gap-1">
              {itemLabels.slice(0, 3).map((label) => (
                <LabelChip 
                  key={label.id} 
                  label={label} 
                  variant="card" 
                  onRemove={() => handleRemoveLabel(label.id)}
                  className="bg-white/20 backdrop-blur-sm text-white border-white/30 hover:bg-white/30 text-xs flex-shrink-0 h-6"
                  size="sm"
                />
              ))}
              
              {/* Botão para adicionar nova label */}
              {!isSelected && itemLabels.length < 3 && (
                <div className={`transition-opacity duration-200 flex-shrink-0 ${
                  hasActiveSelections || isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}>
                  <QuickLabelSelector
                    labels={labels}
                    photoLabels={item.labels.map(l => l.id)}
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
          </div>
          
          {/* Segunda linha - com espaçamento adequado abaixo da principal */}
          {itemLabels.length > 3 && (
            <div className="absolute bottom-0 left-0 right-0 h-6">
              <div className="flex gap-1">
                {itemLabels.slice(3, 6).map((label) => (
                  <LabelChip 
                    key={label.id} 
                    label={label} 
                    variant="card" 
                    onRemove={() => handleRemoveLabel(label.id)}
                    className="bg-white/20 backdrop-blur-sm text-white border-white/30 hover:bg-white/30 text-xs flex-shrink-0 h-6"
                    size="sm"
                  />
                ))}
                
                {/* Botão de "mais" se houver mais de 6 labels */}
                {itemLabels.length > 6 && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button 
                        className="text-xs text-white/90 bg-white/25 backdrop-blur-sm px-2 py-1 rounded-full hover:bg-white/35 transition-colors flex items-center gap-1 flex-shrink-0 h-6"
                        onClick={(e) => e.stopPropagation()}
                        title={`${itemLabels.length} labels no total`}
                      >
                        <span className="text-xs">⋯</span>
                        <span className="text-xs font-medium">{itemLabels.length}</span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-2" align="start">
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground mb-2">
                          Todas as labels:
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {itemLabels.map((label) => (
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
              </div>
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-between relative z-10">
          {/* Drive source indicator */}
          {item.source === 'gdrive' && (
            <div className="text-xs text-white/70 bg-white/10 px-2 py-1 rounded backdrop-blur-sm">
              Drive
            </div>
          )}
          
          <div className="flex items-center gap-1 ml-auto">
            {/* Open in Drive button for Google Drive items */}
            {item.source === 'gdrive' && item.openInDriveUrl && (
              <div className={`transition-opacity duration-200 ${
                hasActiveSelections || isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 rounded-full text-white hover:text-white hover:bg-black/30 bg-black/20 backdrop-blur-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenInDrive();
                  }}
                  title="Abrir no Google Drive"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            )}
            
            {/* Favorite button */}
            <div className={`transition-opacity duration-200 ${
              hasActiveSelections || isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 rounded-full text-white hover:text-white hover:bg-black/30 bg-black/20 backdrop-blur-sm"
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