import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import type { Label } from '@/types/photo';

interface DeleteLabelDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  label: Label | null;
  mediaCount: { photoCount: number; videoCount: number; totalCount: number };
}

export function DeleteLabelDialog({
  isOpen,
  onClose,
  onConfirm,
  label,
  mediaCount
}: DeleteLabelDialogProps) {
  const [dontAskAgain, setDontAskAgain] = useState(false);

  const handleConfirm = () => {
    if (dontAskAgain) {
      localStorage.setItem('photolabel-skip-delete-confirmation', 'true');
    }
    onConfirm();
    onClose();
  };

  const handleCancel = () => {
    setDontAskAgain(false);
    onClose();
  };

  if (!label) return null;

  const hasMedia = mediaCount.totalCount > 0;

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <AlertDialogTitle className="text-left">
                Excluir Label
              </AlertDialogTitle>
              <AlertDialogDescription className="text-left mt-1">
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        <div className="space-y-4">
          {/* Label Preview */}
          <div className="p-3 rounded-lg bg-muted/30 border">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: label.color || '#6b7280' }}
              />
              <span className="font-medium">{label.name}</span>
            </div>
          </div>

          {/* Impact Warning */}
          {hasMedia ? (
            <div className="space-y-2">
              <p className="text-sm text-foreground font-medium">
                Esta label está sendo usada em:
              </p>
              <div className="text-sm text-muted-foreground space-y-1">
                {mediaCount.photoCount > 0 && (
                  <p>• {mediaCount.photoCount} foto{mediaCount.photoCount !== 1 ? 's' : ''}</p>
                )}
                {mediaCount.videoCount > 0 && (
                  <p>• {mediaCount.videoCount} vídeo{mediaCount.videoCount !== 1 ? 's' : ''}</p>
                )}
              </div>
              <p className="text-sm text-destructive">
                A label será removida de todos estes arquivos.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Esta label não está sendo usada em nenhum arquivo.
            </p>
          )}

          {/* Don't ask again option */}
          <div className="flex items-center space-x-2 pt-2 border-t">
            <Checkbox
              id="dont-ask-again"
              checked={dontAskAgain}
              onCheckedChange={(checked) => setDontAskAgain(checked as boolean)}
            />
            <label
              htmlFor="dont-ask-again"
              className="text-sm text-muted-foreground cursor-pointer"
            >
              Não perguntar novamente ao excluir labels
            </label>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          >
            Excluir Label
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}