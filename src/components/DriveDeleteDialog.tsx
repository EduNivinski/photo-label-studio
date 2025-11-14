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

interface DriveDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  fileName: string;
  thumbnailUrl?: string;
  isDeleting: boolean;
}

export function DriveDeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  fileName,
  thumbnailUrl,
  isDeleting,
}: DriveDeleteDialogProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [countdown, setCountdown] = useState(3);
  const [countdownActive, setCountdownActive] = useState(false);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setConfirmed(false);
      setConfirmText("");
      setCountdown(3);
      setCountdownActive(false);
    }
  }, [open]);

  // Start countdown when both checkbox and input are filled
  useEffect(() => {
    if (confirmed && confirmText.toUpperCase() === "DELETAR" && !countdownActive) {
      setCountdownActive(true);
    } else if ((!confirmed || confirmText.toUpperCase() !== "DELETAR") && countdownActive) {
      setCountdownActive(false);
      setCountdown(3);
    }
  }, [confirmed, confirmText, countdownActive]);

  // Countdown timer
  useEffect(() => {
    if (countdownActive && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdownActive, countdown]);

  const canDelete = confirmed && confirmText.toUpperCase() === "DELETAR" && countdown === 0;

  const handleConfirm = async () => {
    if (!canDelete || isDeleting) return;
    await onConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-red-950/95 border-red-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-100">
            <AlertTriangle className="w-6 h-6 text-red-400" />
            DELETAR DO GOOGLE DRIVE
          </DialogTitle>
          <DialogDescription className="text-red-200">
            Esta ação remove o arquivo do seu Google Drive real.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File preview */}
          <div className="flex items-center gap-3 p-3 bg-red-900/50 rounded-lg border border-red-800">
            {thumbnailUrl && (
              <img
                src={thumbnailUrl}
                alt={fileName}
                className="w-12 h-12 object-cover rounded"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-100 truncate">{fileName}</p>
            </div>
          </div>

          {/* Warning messages */}
          <div className="space-y-2 p-4 bg-red-900/30 rounded-lg border border-red-800">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
              <div className="space-y-2 text-sm text-red-100">
                <p className="font-semibold">ATENÇÃO: Esta ação não pode ser desfeita facilmente!</p>
                <ul className="space-y-1 list-none">
                  <li className="flex items-center gap-2">
                    <span className="text-green-400">✓</span>
                    <span>Será movido para a lixeira do Google Drive</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-400">✓</span>
                    <span>Pode ser recuperado em até 30 dias</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-red-400">✗</span>
                    <span>Esta ação remove do seu Drive real</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Confirmation checkbox */}
          <div className="flex items-start gap-3 p-3 bg-red-900/20 rounded-lg">
            <Checkbox
              id="confirm-delete"
              checked={confirmed}
              onCheckedChange={(checked) => setConfirmed(checked === true)}
              className="mt-1"
            />
            <Label
              htmlFor="confirm-delete"
              className="text-sm text-red-100 cursor-pointer leading-tight"
            >
              Confirmo que entendo as consequências e quero deletar este arquivo do Google Drive
            </Label>
          </div>

          {/* Confirmation input */}
          <div className="space-y-2">
            <Label htmlFor="confirm-text" className="text-sm text-red-100">
              Digite <span className="font-bold">"DELETAR"</span> para confirmar:
            </Label>
            <Input
              id="confirm-text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETAR"
              className="bg-red-900/30 border-red-800 text-red-100 placeholder:text-red-400/50"
              disabled={isDeleting}
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
                DELETAR DO DRIVE
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
