import { useState } from 'react';
import { Check, X, Sparkles, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import type { Photo, Label } from '@/types/photo';

interface LabelSuggestionsProps {
  isOpen: boolean;
  onClose: () => void;
  photo: Photo;
  suggestions: string[];
  source: 'ai' | 'mock';
  existingLabels: Label[];
  onApplyLabels: (photoId: string, labelNames: string[]) => Promise<boolean>;
}

export function LabelSuggestions({
  isOpen,
  onClose,
  photo,
  suggestions,
  source,
  existingLabels,
  onApplyLabels
}: LabelSuggestionsProps) {
  const [selectedSuggestions, setSelectedSuggestions] = useState<string[]>([]);
  const [isApplying, setIsApplying] = useState(false);

  const handleToggleSuggestion = (suggestion: string) => {
    setSelectedSuggestions(prev => 
      prev.includes(suggestion)
        ? prev.filter(s => s !== suggestion)
        : [...prev, suggestion]
    );
  };

  const handleApplySelected = async () => {
    if (selectedSuggestions.length === 0) {
      toast.error('Selecione pelo menos uma label para aplicar');
      return;
    }

    setIsApplying(true);
    try {
      const success = await onApplyLabels(photo.id, selectedSuggestions);
      if (success) {
        toast.success(`${selectedSuggestions.length} label${selectedSuggestions.length !== 1 ? 's' : ''} aplicada${selectedSuggestions.length !== 1 ? 's' : ''} com sucesso!`);
        handleClose();
      } else {
        toast.error('Erro ao aplicar labels');
      }
    } catch (error) {
      toast.error('Erro ao aplicar labels');
      console.error('Error applying labels:', error);
    } finally {
      setIsApplying(false);
    }
  };

  const handleApplyAll = async () => {
    setIsApplying(true);
    try {
      const success = await onApplyLabels(photo.id, suggestions);
      if (success) {
        toast.success(`${suggestions.length} label${suggestions.length !== 1 ? 's' : ''} aplicada${suggestions.length !== 1 ? 's' : ''} com sucesso!`);
        handleClose();
      } else {
        toast.error('Erro ao aplicar labels');
      }
    } catch (error) {
      toast.error('Erro ao aplicar labels');
      console.error('Error applying labels:', error);
    } finally {
      setIsApplying(false);
    }
  };

  const handleClose = () => {
    setSelectedSuggestions([]);
    onClose();
  };

  // Filter out suggestions that already exist as labels for this photo
  const existingPhotoLabels = existingLabels
    .filter(label => photo.labels.includes(label.id))
    .map(label => label.name.toLowerCase());

  const filteredSuggestions = suggestions.filter(
    suggestion => !existingPhotoLabels.includes(suggestion.toLowerCase())
  );

  if (filteredSuggestions.length === 0) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Sugestões de Labels
            </DialogTitle>
          </DialogHeader>
          
          <div className="text-center py-6">
            <div className="text-4xl mb-4">✨</div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              Nenhuma sugestão nova
            </h3>
            <p className="text-muted-foreground text-sm">
              Esta foto já possui todas as labels sugeridas ou não há novas sugestões disponíveis.
            </p>
          </div>

          <div className="flex justify-end">
            <Button variant="ghost" onClick={handleClose}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {source === 'ai' ? (
              <Brain className="h-5 w-5 text-primary" />
            ) : (
              <Sparkles className="h-5 w-5 text-primary" />
            )}
            Sugestões de Labels
            <Badge variant="secondary" className="ml-2">
              {source === 'ai' ? 'IA' : 'Mock'}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Photo preview */}
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <img
              src={photo.url}
              alt={photo.name}
              className="w-12 h-12 object-cover rounded"
            />
            <div>
              <div className="font-medium text-sm">{photo.name}</div>
              <div className="text-xs text-muted-foreground">
                {source === 'ai' ? 'Analisado por IA' : 'Sugestões simuladas'}
              </div>
            </div>
          </div>

          {/* Suggestions */}
          <div className="space-y-3">
            <div className="text-sm font-medium">
              Sugestões encontradas ({filteredSuggestions.length}):
            </div>
            
            <div className="flex flex-wrap gap-2">
              {filteredSuggestions.map((suggestion, index) => (
                <Badge
                  key={index}
                  variant={selectedSuggestions.includes(suggestion) ? "default" : "secondary"}
                  className="cursor-pointer transition-all hover:scale-105"
                  onClick={() => handleToggleSuggestion(suggestion)}
                >
                  {suggestion}
                  {selectedSuggestions.includes(suggestion) && (
                    <Check className="ml-1 h-3 w-3" />
                  )}
                </Badge>
              ))}
            </div>

            <div className="text-xs text-muted-foreground">
              Clique nas labels para selecioná-las
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleApplyAll}
              disabled={isApplying}
              className="flex-1"
            >
              <Check className="h-4 w-4 mr-2" />
              Aplicar Todas
            </Button>
            
            <Button
              onClick={handleApplySelected}
              disabled={selectedSuggestions.length === 0 || isApplying}
              variant="outline"
              className="flex-1"
            >
              <Check className="h-4 w-4 mr-2" />
              Aplicar Selecionadas ({selectedSuggestions.length})
            </Button>
          </div>

          <Button 
            variant="ghost" 
            onClick={handleClose}
            className="w-full"
            disabled={isApplying}
          >
            <X className="h-4 w-4 mr-2" />
            Ignorar Sugestões
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}