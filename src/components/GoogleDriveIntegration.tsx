import React, { useState, useCallback, useEffect } from "react";
import { supabase, SUPABASE_URL, SUPABASE_ANON } from "@/integrations/supabase/client";
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

type FolderSelectionState = "idle" | "verifying" | "saving" | "confirming" | "ready" | "error";

export default function GoogleDriveIntegration() {
  const { status, loading, checkStatus, connect, disconnect } = useGoogleDriveSimple();
  const { progress, runFullSync, reset: resetOrchestrator } = useDriveSyncOrchestrator();
  const { toast } = useToast();
  const [showFolderBrowser, setShowFolderBrowser] = useState(false);
  const [preflightResult, setPreflightResult] = useState<{ ok: boolean; reason?: string } | null>(null);
  const [preflightLoading, setPreflightLoading] = useState(true);
  const [folderSelectionState, setFolderSelectionState] = useState<FolderSelectionState>("idle");
  const [selectionMutex, setSelectionMutex] = useState(false);
  const [statusCheckMutex, setStatusCheckMutex] = useState(false);

  const serializedCheckStatus = useCallback(async () => {
    if (statusCheckMutex) return;
    setStatusCheckMutex(true);
    try {
      await checkStatus();
    } finally {
      setStatusCheckMutex(false);
    }
  }, [statusCheckMutex, checkStatus]);

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
    // Atualizar status após seleção (serializado)
    serializedCheckStatus();
  }, [toast, checkStatus]);

  const getStatusState = useCallback(() => {
    if (loading) return "checking";
    if (!status.isConnected) return "disconnected"; 
    if (status.isExpired) return "error";
    return "connected";
  }, [loading, status.isConnected, status.isExpired]);

  const handleSelectCurrentFolder = useCallback(async (id: string, name: string, path?: string) => {
    // Mutex: prevent concurrent selections
    if (selectionMutex) {
      console.warn('[FOLDER_SELECT] Already selecting a folder, ignoring...');
      return;
    }

    setSelectionMutex(true);
    setShowFolderBrowser(false);

    try {
      const traceId = crypto.randomUUID();
      console.log('[FOLDER_SELECT] Starting FSM flow:', { traceId, id, name, path });

      // ========== STATE: VERIFYING ==========
      setFolderSelectionState("verifying");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const headers = {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      };

      console.log('[FOLDER_SELECT][verify] Calling drive-folder-verify...');
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke('drive-folder-verify', {
        body: { folderId: id },
        headers,
      });

      // Handle specific verify errors
      if (verifyError || !verifyData?.ok) {
        const code = verifyData?.code || verifyError?.message || "";
        const errorMsg = verifyData?.error || verifyError?.message || "Pasta não encontrada no Google Drive";
        console.error('[FOLDER_SELECT][verify] Failed:', { code, errorMsg, traceId: verifyData?.traceId });
        setFolderSelectionState("error");

        // Specific error handling
        if (code.includes("401") || code.includes("TOKEN_EXPIRED")) {
          toast({
            title: "Token expirado",
            description: "Reconectando sua conta do Google Drive...",
          });
          await connect(); // Auto-reconnect
          return;
        }

        if (code.includes("403") || code.includes("INSUFFICIENT_SCOPE")) {
          toast({
            title: "Permissões insuficientes",
            description: "Reconectando para obter permissões necessárias...",
          });
          await connect(); // Reconnect with broader scopes
          return;
        }

        if (code.includes("404") || code.includes("FOLDER_NOT_FOUND")) {
          const driveLink = `https://drive.google.com/drive/folders/${id}`;
          toast({
            title: "Pasta não encontrada",
            description: `A pasta não está acessível. Verifique se você tem acesso ou se está na conta correta. Para abrir: ${driveLink}`,
            variant: "destructive",
          });
          throw new Error(errorMsg);
        }

        if (code.includes("SHORTCUT_ID_PROVIDED") && verifyData?.targetId) {
          toast({
            title: "Atalho detectado",
            description: "A pasta selecionada é um atalho. Usando a pasta de destino automaticamente.",
          });
          // Retry with targetId
          return handleSelectCurrentFolder(verifyData.targetId, name, path);
        }

        throw new Error(`${errorMsg} (TraceID: ${verifyData?.traceId || traceId})`);
      }

      console.log('[FOLDER_SELECT][verify] OK:', verifyData);

      // ========== STATE: SAVING ==========
      setFolderSelectionState("saving");
      console.log('[FOLDER_SELECT][save] Calling set_folder...');
      const { data: saveData, error: saveError } = await supabase.functions.invoke('google-drive-auth', {
        body: { 
          action: "set_folder", 
          folderId: id, 
          folderName: name,
          folderPath: path || name
        },
        headers,
      });

      if (saveError || !saveData?.ok || !saveData?.persisted) {
        const errorMsg = saveData?.error || saveError?.message || "Erro ao salvar pasta";
        const saveTraceId = saveData?.traceId || traceId;
        console.error('[FOLDER_SELECT][save] Failed:', { errorMsg, traceId: saveTraceId });
        setFolderSelectionState("error");
        throw new Error(`${errorMsg} (TraceID: ${saveTraceId})`);
      }

      console.log('[FOLDER_SELECT][save] OK:', saveData);

      // ========== STATE: REFRESHING ==========
      setFolderSelectionState("confirming");
      console.log('[FOLDER_SELECT][refresh] Validating consistency...');
      
      // Fetch status (no-store)
      const { data: statusData, error: statusError } = await supabase.functions.invoke('google-drive-auth', {
        body: { action: "status" },
        headers: { ...headers, 'Cache-Control': 'no-store' },
      });

      // Fetch diagnostics (no-store)
      const { data: diagData, error: diagError } = await supabase.functions.invoke('drive-sync-diagnostics', {
        headers: { ...headers, 'Cache-Control': 'no-store' },
      });

      if (statusError || diagError) {
        console.error('[FOLDER_SELECT][refresh] Failed to fetch status/diagnostics:', { statusError, diagError });
        setFolderSelectionState("error");
        throw new Error(`Falha ao validar consistência da pasta (TraceID: ${traceId})`);
      }

      const statusFolderId = statusData?.dedicatedFolderId;
      const diagFolderId = diagData?.settings?.folderId;

      console.log('[FOLDER_SELECT][refresh] Consistency check:', { 
        expected: id, 
        statusFolderId, 
        diagFolderId,
        traceId
      });

      if (statusFolderId !== id || diagFolderId !== id) {
        console.error('[FOLDER_SELECT][refresh] Inconsistency detected!', { 
          expected: id, 
          statusFolderId, 
          diagFolderId,
          traceId
        });
        setFolderSelectionState("error");
        throw new Error(`Inconsistência ao confirmar pasta no servidor (TraceID: ${traceId})`);
      }

      // ========== STATE: READY ==========
      setFolderSelectionState("ready");
      console.log('[FOLDER_SELECT][ready] Folder selection complete:', { traceId, id, name });

      toast({
        title: "Pasta configurada com sucesso",
        description: `"${name}" está pronta. Clique em Sincronizar para indexar os arquivos.`,
      });

      // Only dispatch event AFTER successful validation
      window.dispatchEvent(new CustomEvent('google-drive-folder-updated', {
        detail: {
          dedicatedFolderId: id,
          dedicatedFolderName: name,
          dedicatedFolderPath: path || name,
        }
      }));

      // Refresh status
      await checkStatus();

    } catch (e: any) {
      console.error('[FOLDER_SELECT] Error:', e);
      setFolderSelectionState("error");
      
      // Only show toast if not already handled
      if (!e?.message?.includes("TraceID")) {
        toast({
          title: "Erro ao selecionar pasta",
          description: e?.message || "Não foi possível selecionar a pasta",
          variant: "destructive",
        });
      }
    } finally {
      setSelectionMutex(false);
    }
  }, [toast, checkStatus, connect, selectionMutex]);

  const buildFolderPath = useCallback(() => {
    // Priorizar dedicatedFolderPath se existir, senão usar o nome da pasta
    if (status.dedicatedFolderPath) return status.dedicatedFolderPath;
    if (!status.dedicatedFolder) return null;
    return typeof status.dedicatedFolder === 'string' 
      ? status.dedicatedFolder 
      : status.dedicatedFolder.name;
  }, [status.dedicatedFolderPath, status.dedicatedFolder]);

  const handleSyncClick = useCallback(async () => {
    // Block if folder selection is not in "ready" or "idle" state
    if (folderSelectionState !== "ready" && folderSelectionState !== "idle") {
      toast({
        title: "Aguarde",
        description: "Aguarde a validação da pasta antes de sincronizar.",
      });
      return;
    }

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

      // Reset FSM state before sync
      setFolderSelectionState("idle");

      // Use orchestrator for full flow: verify root → index → sync-run loop → changes-pull
      await runFullSync(folderId, folderName, folderPath);

      // Refresh status after completion
      serializedCheckStatus();
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
  }, [status, runFullSync, toast, checkStatus, folderSelectionState]);

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
        <>
          {/* Show folder selection state */}
          {folderSelectionState !== "idle" && folderSelectionState !== "ready" && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                <div className="flex-1">
                  <p className="font-medium text-blue-900">
                    {folderSelectionState === "verifying" && "Verificando pasta no Google Drive..."}
                    {folderSelectionState === "saving" && "Salvando configuração..."}
                    {folderSelectionState === "confirming" && "Confirmando consistência..."}
                    {folderSelectionState === "error" && "Erro ao selecionar pasta"}
                  </p>
                  <p className="text-sm text-blue-700 mt-1">
                    {folderSelectionState === "verifying" && "Validando acesso e permissões"}
                    {folderSelectionState === "saving" && "Persistindo configuração no servidor"}
                    {folderSelectionState === "confirming" && "Validando configuração salva"}
                    {folderSelectionState === "error" && "Verifique os erros acima"}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <DriveFolderSelectionCard
            dedicatedFolderPath={buildFolderPath()}
            onChooseFolder={() => {
              if (folderSelectionState === "idle" || folderSelectionState === "ready" || folderSelectionState === "error") {
                setShowFolderBrowser(true);
              }
            }}
            onSync={handleSyncClick}
            syncing={
              progress.phase === 'indexing' || 
              progress.phase === 'syncing' || 
              folderSelectionState === 'verifying' || 
              folderSelectionState === 'saving' || 
              folderSelectionState === 'confirming'
            }
            syncProgress={progress.phase !== 'idle' ? {
              processedFolders: progress.processedFolders || 0,
              queued: progress.queuedFolders || 0,
              updatedItems: progress.updatedItems || 0
            } : null}
            disabled={
              folderSelectionState === 'verifying' || 
              folderSelectionState === 'saving' || 
              folderSelectionState === 'confirming'
            }
          />
        </>
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