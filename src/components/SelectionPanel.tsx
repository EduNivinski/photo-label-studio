import { Tag, Trash2, X, Archive, Loader2, AlertTriangle, Cloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface SelectionPanelProps {
  selectedCount: number;
  totalCount: number;
  selectedDriveCount?: number;
  onManageLabels: () => void;
  onDeleteSelected: () => void;
  onDeleteSelectedFromDrive?: () => void;
  onClearSelection: () => void;
  onSelectAll: () => void;
  onCreateCollection?: () => void;
  isDeleting?: boolean;
  isDeletingFromDrive?: boolean;
  deleteProgress?: { current: number; total: number };
}

export function SelectionPanel({
  selectedCount,
  totalCount,
  selectedDriveCount = 0,
  onManageLabels,
  onDeleteSelected,
  onDeleteSelectedFromDrive,
  onClearSelection,
  onSelectAll,
  onCreateCollection,
  isDeleting,
  isDeletingFromDrive,
  deleteProgress
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
          {selectedDriveCount > 0 && (
            <span className="text-xs text-muted-foreground ml-1">
              ({selectedDriveCount} do Drive)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onSelectAll}
            className="flex items-center gap-2"
          >
            {selectedCount === totalCount ? 'Desmarcar todos' : 'Selecionar tudo'}
          </Button>

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
            disabled={isDeleting}
            className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Deletando ({deleteProgress?.current}/{deleteProgress?.total})
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Deletar do PhotoLabel
              </>
            )}
          </Button>

          {selectedDriveCount > 0 && onDeleteSelectedFromDrive && (
            <Button
              size="sm"
              variant="destructive"
              onClick={onDeleteSelectedFromDrive}
              disabled={isDeletingFromDrive}
              className="flex items-center gap-2 bg-red-950 hover:bg-red-900"
            >
              {isDeletingFromDrive ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deletando ({deleteProgress?.current}/{deleteProgress?.total})
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4" />
                  Deletar {selectedDriveCount} do Drive
                </>
              )}
            </Button>
          )}

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