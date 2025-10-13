import React, { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useGoogleDriveSimple } from "@/hooks/useGoogleDriveSimple";
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
  const { toast } = useToast();
  const [showFolderBrowser, setShowFolderBrowser] = useState(false);
  const [preflightResult, setPreflightResult] = useState<{ ok: boolean; reason?: string } | null>(null);
  const [preflightLoading, setPreflightLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{
    processedFolders: number;
    queued: number;
    updatedItems: number;
  } | null>(null);

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
      const { data, error } = await supabase.functions.invoke("google-drive-auth", {
        body: { 
          action: "set_folder", 
          folderId: id, 
          folderName: name,
          folderPath: path || name
        }
      });
      
      if (error || !data?.ok) throw new Error(data?.reason || error?.message || "SET_FOLDER_FAILED");

      toast({
        title: "Pasta selecionada",
        description: `Pasta "${data.dedicatedFolderName}" configurada.`,
      });

      setShowFolderBrowser(false);
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
      setSyncing(true);
      setSyncProgress({ processedFolders: 0, queued: 0, updatedItems: 0 });

      // Iniciar sincronização
      const { data: startData, error: startError } = await supabase.functions.invoke("drive-sync-start", {
        body: { force: false }
      });

      if (startError) {
        console.error("[SYNC_CLIENT_ERROR] start failed:", { cid: startData?.cid, error: startError });
        throw startError;
      }

      console.log("[SYNC_CLIENT] Started:", { cid: startData?.cid });

      // Loop de sincronização
      let done = false;
      let totalProcessed = 0;
      let totalItems = 0;

      while (!done) {
        const { data, error } = await supabase.functions.invoke("drive-sync-run", {
          body: { budgetFolders: 5 }
        });

        if (error) {
          console.error("[SYNC_CLIENT_ERROR] run failed:", { cid: data?.cid, error });
          throw error;
        }

        done = data?.done || false;
        totalProcessed += data?.processedFolders || 0;
        totalItems += data?.updatedItems || 0;

        console.log("[SYNC_CLIENT] Progress:", { 
          cid: data?.cid, 
          done, 
          totalProcessed, 
          totalItems,
          queued: data?.queued 
        });

        setSyncProgress({
          processedFolders: totalProcessed,
          queued: data?.queued || 0,
          updatedItems: totalItems
        });

        if (!done) {
          await new Promise(r => setTimeout(r, 350));
        }
      }

      toast({
        title: "Sincronização concluída",
        description: `${totalItems} arquivos processados em ${totalProcessed} pastas`
      });

      // Atualizar status e disparar evento de atualização
      checkStatus();
      window.dispatchEvent(new CustomEvent('google-drive-status-changed'));

    } catch (error: any) {
      console.error("[SYNC_CLIENT_ERROR] Final error:", error);
      toast({
        title: "Erro na sincronização",
        description: error.message || "Não foi possível sincronizar",
        variant: "destructive"
      });
    } finally {
      setSyncing(false);
      setSyncProgress(null);
    }
  }, [toast, checkStatus]);

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
        />
      )}

      {/* Nova seção: Sincronização - aparece somente quando a seção de pasta é visível e há pasta salva */}
      {status.isConnected && Boolean(buildFolderPath()) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sincronização</CardTitle>
            <CardDescription>
              Sincronize os arquivos da pasta selecionada
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {syncProgress && (
                <div className="text-sm text-muted-foreground">
                  Processando: {syncProgress.processedFolders} pastas, {syncProgress.updatedItems} arquivos
                  {syncProgress.queued > 0 && ` (${syncProgress.queued} pendentes)`}
                </div>
              )}
              <div className="flex items-center justify-end">
                <Button
                  onClick={handleSyncClick}
                  disabled={syncing}
                  className="shrink-0 bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
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