import React, { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useGoogleDriveSimple } from "@/hooks/useGoogleDriveSimple";
import { useDriveSyncOrchestrator } from "@/hooks/useDriveSyncOrchestrator";
import { useToast } from "@/hooks/use-toast";
import { DriveIntegrationCard } from "./DriveIntegrationCard";
import { DriveFolderSelectionCard } from "./DriveFolderSelectionCard";
import { DriveBrowserCard } from "./DriveBrowserCard";
import { preflightDriveCallback } from "@/lib/drivePreflightCheck";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2 } from "lucide-react";

export default function GoogleDriveIntegration() {
  const { status, loading, checkStatus, connect, disconnect } = useGoogleDriveSimple();
  const { progress, runFullSync, reset: resetOrchestrator } = useDriveSyncOrchestrator();
  const { toast } = useToast();
  const [showFolderBrowser, setShowFolderBrowser] = useState(false);
  const [preflightResult, setPreflightResult] = useState<{ ok: boolean; reason?: string } | null>(null);
  const [preflightLoading, setPreflightLoading] = useState(true);

  // Preflight check on component mount
  useEffect(() => {
    const runPreflightCheck = async () => {
      setPreflightLoading(true);
      const result = await preflightDriveCallback();
      setPreflightResult(result);
      setPreflightLoading(false);
    };
    runPreflightCheck();
  }, []);

  const handleConnect = async () => {
    if (!preflightResult?.ok) return; // Block if preflight failed
    await connect();
  };

  const handleDisconnect = async () => {
    await disconnect();
  };

  const handleReconnect = async () => {
    if (!preflightResult?.ok) return; // Block if preflight failed
    try {
      const { data } = await supabase.functions.invoke("google-drive-auth", {
        body: { 
          action: "authorize", 
          redirect: window.location.origin + "/settings/drive" 
        }
      });
      const url = data?.authorizeUrl;
      if (url) {
        window.open(url, "_blank", "width=520,height=720");
        toast({
          title: "Redirecionando...",
          description: "Você será redirecionado para autorizar o Google Drive",
        });
      }
    } catch (e: any) {
      toast({
        title: "Erro",
        description: `Erro ao reconectar: ${e?.message || e}`,
        variant: "destructive",
      });
    }
  };

  const handleReconnectWithPermissions = async () => {
    if (!preflightResult?.ok) return; // Block if preflight failed
    try {
      const { data } = await supabase.functions.invoke("google-drive-auth", {
        body: { 
          action: "authorize", 
          redirect: window.location.origin + "/settings/drive", 
          forceConsent: true 
        }
      });
      const url = data?.authorizeUrl;
      if (url) {
        window.open(url, "_blank", "width=520,height=720");
        toast({
          title: "Reconectando...",
          description: "Você será redirecionado para reconectar com novas permissões",
        });
      }
    } catch (e: any) {
      toast({
        title: "Erro",
        description: `Falha ao iniciar processo de reconexão: ${e?.message || e}`,
        variant: "destructive",
      });
    }
  };

  const handleFolderSelected = useCallback((folder: { id: string; name: string }) => {
    console.log('Pasta selecionada:', folder);
    setShowFolderBrowser(false);
    toast({
      title: "Pasta selecionada",
      description: `Pasta "${folder.name}" configurada para backup.`,
    });
    // Atualizar status após seleção
    checkStatus();
  }, [toast, checkStatus]);

  const getStatusState = useCallback(() => {
    if (loading) return "checking";
    if (!status.isConnected) return "disconnected"; 
    if (status.isExpired) return "error";
    return "connected";
  }, [loading, status.isConnected, status.isExpired]);

  const handleSelectCurrentFolder = useCallback(async (id: string, name: string, path?: string) => {
    try {
      setShowFolderBrowser(false);
      
      // ONLY save folder - do NOT auto-index or sync
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const { data: saveData, error: saveError } = await supabase.functions.invoke('google-drive-auth', {
        body: { 
          action: "set_folder", 
          folderId: id, 
          folderName: name,
          folderPath: path || name
        },
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (saveError || !saveData?.ok) {
        const errorMsg = saveData?.error || saveError?.message || "Erro ao salvar pasta";
        throw new Error(errorMsg);
      }

      toast({
        title: "Pasta salva",
        description: `Pasta "${name}" configurada. Clique em Sincronizar para indexar.`,
      });
      
      // Refresh status to show new folder
      checkStatus();
    } catch (e: any) {
      toast({
        title: "Erro",
        description: `Não foi possível selecionar a pasta: ${e?.message || e}`,
        variant: "destructive",
      });
    }
  }, [toast, checkStatus]);

  const buildFolderPath = useCallback(() => {
    // Priorizar dedicatedFolderPath se existir, senão usar o nome da pasta
    if (status.dedicatedFolderPath) return status.dedicatedFolderPath;
    if (!status.dedicatedFolder) return null;
    return typeof status.dedicatedFolder === 'string' 
      ? status.dedicatedFolder 
      : status.dedicatedFolder.name;
  }, [status.dedicatedFolderPath, status.dedicatedFolder]);

  const handleSyncClick = useCallback(async () => {
    try {
      // Get current folder from status
      const folderData = typeof status.dedicatedFolder === 'string' 
        ? { id: status.dedicatedFolder, name: status.dedicatedFolder }
        : status.dedicatedFolder;
      
      const folderId = folderData?.id;
      const folderName = folderData?.name;
      const folderPath = status.dedicatedFolderPath;

      if (!folderId || !folderName) {
        toast({
          title: "Erro",
          description: "Nenhuma pasta configurada. Selecione uma pasta primeiro.",
          variant: "destructive",
        });
        return;
      }

      // Use orchestrator for full flow: index → sync-run loop → changes-pull
      await runFullSync(folderId, folderName, folderPath);

      // Refresh status after completion
      checkStatus();
      window.dispatchEvent(new CustomEvent('google-drive-status-changed'));

    } catch (error: any) {
      console.error("[SYNC_CLIENT_ERROR] Final error:", error);
      
      const errorMsg = error?.message || "Não foi possível sincronizar";
      const hint = error?.hint || "";
      
      toast({
        title: "Erro na sincronização",
        description: `${errorMsg}${hint ? '. ' + hint : ''}`,
        variant: "destructive"
      });
    }
  }, [status, runFullSync, toast, checkStatus]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <DriveIntegrationCard
        state={getStatusState()}
        onCheck={checkStatus}
        onConnect={handleConnect}
        onReconnect={handleReconnect}
        onReconnectWithConsent={handleReconnectWithPermissions}
        onDisconnect={handleDisconnect}
        preflightResult={preflightResult}
        preflightLoading={preflightLoading}
      />

      {!status.isConnected && (
        <div className="text-center py-8">
          <h3 className="text-lg font-medium mb-2">Conectar ao Google Drive</h3>
          <p className="text-muted-foreground mb-6">
            Conecte sua conta do Google Drive para fazer backup e importar suas fotos
          </p>
        </div>
      )}

      {/* Seção de Seleção de Pasta - mostra apenas quando conectado */}
      {status.isConnected && (
        <DriveFolderSelectionCard
          dedicatedFolderPath={buildFolderPath()}
          onChooseFolder={() => setShowFolderBrowser(true)}
          onSync={handleSyncClick}
          syncing={progress.phase === 'indexing' || progress.phase === 'syncing'}
          syncProgress={progress.phase !== 'idle' ? {
            processedFolders: progress.processedFolders || 0,
            queued: progress.queuedFolders || 0,
            updatedItems: progress.updatedItems || 0
          } : null}
        />
      )}
      
      {/* Progress indicator */}
      {(progress.phase === 'indexing' || progress.phase === 'syncing') && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <div className="flex-1">
                <p className="font-medium">{progress.message}</p>
                {progress.updatedItems !== undefined && (
                  <p className="text-sm text-muted-foreground">
                    {progress.updatedItems} arquivos • {progress.processedFolders || 0} pastas processadas
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      {showFolderBrowser && (
        <DriveBrowserCard
          onSelectCurrentFolder={handleSelectCurrentFolder}
        />
      )}
    </div>
  );
}