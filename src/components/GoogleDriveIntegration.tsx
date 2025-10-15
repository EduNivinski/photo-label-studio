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

      // ========== AUTH ==========
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      // Helper to call edge functions with proper error parsing
      const callEdge = async (fn: string, method: 'GET' | 'POST', body?: any) => {
        const url = `${SUPABASE_URL}/functions/v1/${fn}`;
        const opts: RequestInit = {
          method,
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': SUPABASE_ANON,
          }
        };
        
        if (method === 'POST' && body) {
          opts.headers = { ...opts.headers, 'Content-Type': 'application/json' };
          opts.body = JSON.stringify(body);
        }

        const resp = await fetch(url, opts);
        let json: any = null;
        try {
          json = await resp.json();
        } catch (e) {
          console.error(`[callEdge][${fn}] Failed to parse JSON:`, e);
        }

        return { resp, json };
      };

      // ========== STATE: VERIFYING ==========
      setFolderSelectionState('verifying');
      console.log('[FOLDER_SELECT][verify] payload:', { folderId: id });

      const { resp: vResp, json: vJson } = await callEdge('drive-folder-verify', 'POST', { folderId: id });

      console.log('[FOLDER_SELECT][verify] response:', {
        status: vResp.status,
        ok: vResp.ok,
        code: vJson?.code,
        traceId: vJson?.traceId
      });

      if (!vResp.ok || !vJson?.ok) {
        const code = vJson?.code || 'VERIFY_FAILED';
        const message = vJson?.error || vJson?.message || 'Falha ao verificar pasta';
        const vTraceId = vJson?.traceId || traceId;
        
        console.error('[FOLDER_SELECT][verify] Failed:', { status: vResp.status, code, message, traceId: vTraceId });
        setFolderSelectionState('error');

        // Handle specific codes
        if (code === 'TOKEN_EXPIRED' || code.includes('401')) {
          toast({
            title: 'Token expirado',
            description: 'Reconectando sua conta do Google Drive...',
          });
          await connect();
          return;
        }

        if (code === 'INSUFFICIENT_SCOPE' || code.includes('403')) {
          toast({
            title: 'Permissões insuficientes',
            description: 'Reconectando para obter as permissões necessárias (drive.metadata.readonly)...',
          });
          await connect();
          return;
        }

        if (code === 'SHORTCUT_ID_PROVIDED' && vJson?.targetId) {
          toast({
            title: 'Atalho detectado',
            description: 'A pasta escolhida era um atalho. Resolvendo para a pasta de destino automaticamente.',
          });
          setSelectionMutex(false);
          return handleSelectCurrentFolder(vJson.targetId, name, path);
        }

        if (code === 'NOT_A_FOLDER') {
          toast({
            title: 'Não é uma pasta',
            description: `O item selecionado não é uma pasta válida do Google Drive. • TraceID: ${vTraceId}`,
            variant: 'destructive',
          });
          return;
        }

        if (code === 'FOLDER_TRASHED') {
          toast({
            title: 'Pasta na lixeira',
            description: `A pasta selecionada está na lixeira do Google Drive. • TraceID: ${vTraceId}`,
            variant: 'destructive',
          });
          return;
        }

        if (code === 'FOLDER_NOT_FOUND' || code.includes('404')) {
          const driveLink = `https://drive.google.com/drive/folders/${id}`;
          toast({
            title: 'Pasta não encontrada',
            description: `A pasta não está acessível. Verifique se você tem acesso ou se está na conta correta. [Abrir no Drive](${driveLink}) • TraceID: ${vTraceId}`,
            variant: 'destructive',
          });
          return;
        }

        // Generic error
        toast({
          title: 'Falha na verificação',
          description: `${message} (${code}) • TraceID: ${vTraceId}`,
          variant: 'destructive',
        });
        return;
      }

      const resolvedId = vJson?.lookup?.resolved?.id || id;
      console.log('[FOLDER_SELECT][verify] OK:', { resolvedId, mimeType: vJson?.lookup?.resolved?.mimeType });

      // ========== STATE: SAVING ==========
      setFolderSelectionState('saving');
      
      const { resp: sResp, json: sJson } = await callEdge('google-drive-auth', 'POST', {
        action: 'set_folder',
        folderId: resolvedId,
        folderName: name,
        folderPath: path || name
      });

      console.log('[FOLDER_SELECT][save] response:', {
        status: sResp.status,
        ok: sJson?.ok,
        persisted: sJson?.persisted,
        savedFolderId: sJson?.savedFolderId,
        traceId: sJson?.traceId
      });

      if (!sResp.ok || !sJson?.ok || !sJson?.persisted) {
        const code = sJson?.code || 'SAVE_FAILED';
        const message = sJson?.error || sJson?.message || 'Erro ao salvar pasta';
        const sTraceId = sJson?.traceId || traceId;

        console.error('[FOLDER_SELECT][save] Failed:', { status: sResp.status, code, message, traceId: sTraceId });
        setFolderSelectionState('error');

        toast({
          title: 'Erro ao salvar pasta',
          description: `${message} (${code}) • TraceID: ${sTraceId}`,
          variant: 'destructive',
        });
        return;
      }

      console.log('[FOLDER_SELECT][save] OK:', { savedFolderId: sJson.savedFolderId, savedFolderName: sJson.savedFolderName });

      // ========== STATE: CONFIRMING ==========
      setFolderSelectionState('confirming');
      console.log('[FOLDER_SELECT][confirming] Validating consistency...');

      const { resp: stResp, json: stJson } = await callEdge('google-drive-auth', 'POST', { action: 'status' });
      const { resp: dgResp, json: dgJson } = await callEdge('drive-sync-diagnostics', 'GET');

      if (!stResp.ok || !dgResp.ok) {
        console.error('[FOLDER_SELECT][confirming] Failed to fetch status/diagnostics:', {
          statusStatus: stResp.status,
          diagStatus: dgResp.status
        });
        setFolderSelectionState('error');
        toast({
          title: 'Falha ao confirmar',
          description: 'Não foi possível confirmar a pasta no servidor.',
          variant: 'destructive',
        });
        return;
      }

      const statusFolderId = stJson?.dedicatedFolderId;
      const diagFolderId = dgJson?.settings?.folderId;

      console.log('[FOLDER_SELECT][confirming] Consistency check:', {
        expected: resolvedId,
        statusFolderId,
        diagFolderId,
        traceId
      });

      if (statusFolderId !== resolvedId || diagFolderId !== resolvedId) {
        console.error('[FOLDER_SELECT][confirming] Inconsistency detected!', {
          expected: resolvedId,
          statusFolderId,
          diagFolderId,
          traceId
        });
        setFolderSelectionState('error');
        toast({
          title: 'Inconsistência detectada',
          description: `Falha ao confirmar pasta no servidor (inconsistência). • TraceID: ${traceId}`,
          variant: 'destructive',
        });
        return;
      }

      // ========== STATE: READY ==========
      setFolderSelectionState('ready');
      console.log('[FOLDER_SELECT][ready] Folder selection complete:', { traceId, id: resolvedId, name });

      toast({
        title: 'Pasta configurada com sucesso',
        description: `"${name}" está pronta. Clique em Sincronizar para indexar os arquivos.`,
      });

      window.dispatchEvent(new CustomEvent('google-drive-folder-updated', {
        detail: {
          dedicatedFolderId: resolvedId,
          dedicatedFolderName: name,
          dedicatedFolderPath: path || name,
        }
      }));

      await serializedCheckStatus();

    } catch (e: any) {
      console.error('[FOLDER_SELECT] Unexpected error:', e);
      setFolderSelectionState('error');
      
      toast({
        title: 'Erro ao selecionar pasta',
        description: e?.message || 'Não foi possível selecionar a pasta',
        variant: 'destructive',
      });
    } finally {
      setSelectionMutex(false);
    }
  }, [toast, serializedCheckStatus, connect, selectionMutex]);

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