import { Folder, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  dedicatedFolderPath?: string | null;
  onChooseFolder: () => void;
  disabled?: boolean;
  onSync?: () => void;
  syncing?: boolean;
  syncProgress?: {
    processedFolders: number;
    queued: number;
    updatedItems: number;
  } | null;
};

export function DriveFolderSelectionCard({
  dedicatedFolderPath,
  onChooseFolder,
  disabled = false,
  onSync,
  syncing = false,
  syncProgress,
}: Props) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
      <h3 className="text-lg font-semibold">Pasta de Backup</h3>
      
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground flex-1 min-w-0">
            {dedicatedFolderPath ? (
              <div className="flex items-center gap-1">
                <span className="shrink-0">Pasta selecionada:</span>
                <span 
                  className="font-medium text-foreground truncate block" 
                  style={{ direction: 'rtl', textAlign: 'left' }}
                  title={dedicatedFolderPath}
                >
                  {dedicatedFolderPath}
                </span>
              </div>
            ) : (
              <span>Nenhuma pasta selecionada. Clique em "Buscar pasta" para começar.</span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {dedicatedFolderPath && onSync && (
              <Button
                onClick={onSync}
                disabled={syncing || disabled}
                className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                title={disabled ? "Aguarde a validação da pasta" : "Iniciar sincronização"}
              >
                {syncing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Sincronizando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Sincronizar
                  </>
                )}
              </Button>
            )}
            <Button 
              onClick={onChooseFolder} 
              disabled={disabled}
              title={disabled ? "Aguarde a operação atual" : "Escolher pasta do Google Drive"}
            >
              <Folder className="h-4 w-4 mr-1" /> 
              {dedicatedFolderPath ? "Trocar pasta" : "Buscar pasta"}
            </Button>
          </div>
        </div>
        
        {syncProgress && (
          <div className="text-sm text-muted-foreground">
            Processando: {syncProgress.processedFolders} pastas, {syncProgress.updatedItems} arquivos
            {syncProgress.queued > 0 && ` (${syncProgress.queued} pendentes)`}
          </div>
        )}
      </div>
    </div>
  );
}
