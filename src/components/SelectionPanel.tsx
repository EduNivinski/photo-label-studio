import { Tag, Trash2, X, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface SelectionPanelProps {
  selectedCount: number;
  onManageLabels: () => void;
  onDeleteSelected: () => void;
  onClearSelection: () => void;
  onCreateCollection?: () => void;
}

export function SelectionPanel({
  selectedCount,
  onManageLabels,
  onDeleteSelected,
  onClearSelection,
  onCreateCollection
}: SelectionPanelProps) {
  if (selectedCount === 0) return null;

  return (
    <Card className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 shadow-lg border-primary">
      <div className="flex items-center gap-4 p-4">
        <div className="flex items-center gap-2">
          <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium">
            {selectedCount}
          </div>
          <span className="text-sm font-medium">
            arquivo{selectedCount !== 1 ? 's' : ''} selecionado{selectedCount !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onCreateCollection && (
            <Button
              size="sm"
              onClick={onCreateCollection}
              className="flex items-center gap-2 bg-primary hover:bg-primary/90"
            >
              <Archive className="h-4 w-4" />
              Criar Coleção
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={onManageLabels}
            className="flex items-center gap-2"
          >
            <Tag className="h-4 w-4" />
            Gerenciar Labels
          </Button>

          <Button
            size="sm"
            variant="destructive"
            onClick={onDeleteSelected}
            className="flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Deletar
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={onClearSelection}
            className="flex items-center gap-2"
          >
            <X className="h-4 w-4" />
            Limpar
          </Button>
        </div>
      </div>
    </Card>
  );
}