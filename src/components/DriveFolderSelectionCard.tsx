import { Folder, RefreshCw, Loader2, FileIcon, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

type Props = {
  dedicatedFolderPath?: string | null;
  onChooseFolder: () => void;
  disabled?: boolean;
  onSync?: () => void;
  onSyncBackground?: () => void;
  syncing?: boolean;
  syncProgress?: {
    processedFolders: number;
    queued: number;
    updatedItems: number;
  } | null;
  backgroundSyncProgress?: {
    status: string;
    processed: number;
    pending: number;
  } | null;
};

export function DriveFolderSelectionCard({
  dedicatedFolderPath,
  onChooseFolder,
  disabled = false,
  onSync,
  onSyncBackground,
  syncing = false,
  syncProgress,
  backgroundSyncProgress,
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
            {dedicatedFolderPath && onSyncBackground && backgroundSyncProgress?.status !== 'running' && (
              <Button
                onClick={onSyncBackground}
                disabled={disabled}
                variant="outline"
                className="text-blue-600 border-blue-600 hover:bg-blue-50"
                title="Sincronizar em background (continua mesmo se você fechar o site)"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Sync Background
              </Button>
            )}
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
          <div className="space-y-2">
            {/* Barra de Progresso */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Progresso da Sincronização</span>
                <span className="font-medium">
                  {syncProgress.processedFolders}/{syncProgress.processedFolders + syncProgress.queued} pastas
                </span>
              </div>
              <Progress 
                value={
                  syncProgress.queued === 0 && syncProgress.processedFolders === 0
                    ? 0
                    : (syncProgress.processedFolders / (syncProgress.processedFolders + syncProgress.queued)) * 100
                } 
                className="h-2"
              />
            </div>
            
            {/* Informações Detalhadas */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Folder className="h-3 w-3" />
                <span>{syncProgress.processedFolders} processadas</span>
              </div>
              <div className="flex items-center gap-1">
                <FileIcon className="h-3 w-3" />
                <span>{syncProgress.updatedItems} sincronizados</span>
              </div>
              {syncProgress.queued > 0 && (
                <div className="flex items-center gap-1 text-orange-600">
                  <Clock className="h-3 w-3" />
                  <span>{syncProgress.queued} pendentes</span>
                </div>
              )}
            </div>
          </div>
        )}
        
        {backgroundSyncProgress && backgroundSyncProgress.status === 'running' && (
          <div className="text-sm text-blue-600 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>
              Sincronizando em background: {backgroundSyncProgress.processed} processadas
              {backgroundSyncProgress.pending > 0 && ` (${backgroundSyncProgress.pending} pendentes)`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
