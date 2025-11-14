import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DriveBulkDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  files: Array<{ id: string; name: string; thumbnailUrl?: string }>;
  isDeleting: boolean;
  deleteProgress?: { current: number; total: number };
}

export function DriveBulkDeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  files,
  isDeleting,
  deleteProgress,
}: DriveBulkDeleteDialogProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [countdown, setCountdown] = useState(3);
  const [countdownActive, setCountdownActive] = useState(false);

  const fileCount = files.length;
  const expectedInput = fileCount.toString();

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setConfirmed(false);
      setConfirmText("");
      setCountdown(3);
      setCountdownActive(false);
    }
  }, [open]);

  // Start countdown when both checkbox and input are filled correctly
  useEffect(() => {
    if (confirmed && confirmText === expectedInput && !countdownActive) {
      setCountdownActive(true);
    } else if ((!confirmed || confirmText !== expectedInput) && countdownActive) {
      setCountdownActive(false);
      setCountdown(3);
    }
  }, [confirmed, confirmText, expectedInput, countdownActive]);

  // Countdown timer
  useEffect(() => {
    if (countdownActive && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdownActive, countdown]);

  const canDelete = confirmed && confirmText === expectedInput && countdown === 0;

  const handleConfirm = async () => {
    if (!canDelete || isDeleting) return;
    await onConfirm();
  };

  const progressPercentage = deleteProgress
    ? (deleteProgress.current / deleteProgress.total) * 100
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-red-950/95 border-red-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-100">
            <AlertTriangle className="w-6 h-6 text-red-400" />
            DELETAR MÚLTIPLOS DO GOOGLE DRIVE
          </DialogTitle>
          <DialogDescription className="text-red-200">
            Você está prestes a deletar {fileCount} arquivo{fileCount !== 1 ? 's' : ''} do Google Drive
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File list preview */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-red-100">
              Arquivos selecionados ({fileCount}):
            </p>
            <ScrollArea className="h-[150px] rounded-lg border border-red-800 bg-red-900/30 p-2">
              <div className="space-y-2">
                {files.slice(0, 10).map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-2 p-2 bg-red-900/50 rounded"
                  >
                    {file.thumbnailUrl && (
                      <img
                        src={file.thumbnailUrl}
                        alt={file.name}
                        className="w-8 h-8 object-cover rounded"
                      />
                    )}
                    <span className="text-xs text-red-100 truncate flex-1">
                      {file.name}
                    </span>
                  </div>
                ))}
                {fileCount > 10 && (
                  <p className="text-xs text-red-300 text-center py-2">
                    ... e mais {fileCount - 10} arquivo{fileCount - 10 !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Warning messages */}
          <div className="space-y-2 p-4 bg-red-900/30 rounded-lg border border-red-800">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
              <div className="space-y-2 text-sm text-red-100">
                <p className="font-semibold">ATENÇÃO: Todos os arquivos serão deletados!</p>
                <ul className="space-y-1 list-none">
                  <li className="flex items-center gap-2">
                    <span className="text-green-400">✓</span>
                    <span>Serão movidos para a lixeira do Google Drive</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-400">✓</span>
                    <span>Podem ser recuperados em até 30 dias</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-red-400">✗</span>
                    <span>Esta ação remove TODOS do seu Drive real</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Confirmation checkbox */}
          <div className="flex items-start gap-3 p-3 bg-red-900/20 rounded-lg">
            <Checkbox
              id="confirm-bulk-delete"
              checked={confirmed}
              onCheckedChange={(checked) => setConfirmed(checked === true)}
              className="mt-1"
            />
            <Label
              htmlFor="confirm-bulk-delete"
              className="text-sm text-red-100 cursor-pointer leading-tight"
            >
              Confirmo que entendo as consequências e quero deletar TODOS estes arquivos do Google Drive
            </Label>
          </div>

          {/* Confirmation input */}
          <div className="space-y-2">
            <Label htmlFor="confirm-number" className="text-sm text-red-100">
              Digite o número de arquivos <span className="font-bold">({fileCount})</span> para confirmar:
            </Label>
            <Input
              id="confirm-number"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={expectedInput}
              className="bg-red-900/30 border-red-800 text-red-100 placeholder:text-red-400/50"
              disabled={isDeleting}
              type="number"
            />
          </div>

          {/* Countdown display */}
          {countdownActive && countdown > 0 && (
            <div className="text-center p-2 bg-red-900/30 rounded-lg">
              <p className="text-sm text-red-200">
                Botão será ativado em: <span className="font-bold">{countdown} segundo{countdown !== 1 ? 's' : ''}</span>
              </p>
            </div>
          )}

          {/* Progress bar during deletion */}
          {isDeleting && deleteProgress && (
            <div className="space-y-2 p-3 bg-red-900/30 rounded-lg">
              <p className="text-sm text-red-100 text-center">
                Deletando arquivos... {deleteProgress.current}/{deleteProgress.total}
              </p>
              <Progress value={progressPercentage} className="h-2" />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
            className="border-red-700 text-red-100 hover:bg-red-900/50"
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!canDelete || isDeleting}
            className="bg-red-600 hover:bg-red-700 disabled:opacity-50"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Deletando...
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 mr-2" />
                DELETAR {fileCount} ARQUIVOS
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
