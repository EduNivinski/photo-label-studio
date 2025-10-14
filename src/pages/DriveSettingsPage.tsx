import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Loader2, Cloud, Folder, Unplug, RefreshCw, Settings, AlertCircle, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import FolderPickerModal from "@/components/Drive/FolderPickerModal";
import DriveBrowser from "@/components/Drive/DriveBrowser";
import { GoogleDriveSmokeTests } from "@/components/GoogleDriveSmokeTests";

type DriveStatus =
  | { ok: true; connected: true }
  | { ok: true; connected: false; reason?: string }
  | { ok: false; reason: string };

type FileItem = { id: string; name: string; mimeType?: string };

export default function DriveSettingsPage() {
  const [status, setStatus] = useState<DriveStatus>({ ok: true, connected: false });
  const [loading, setLoading] = useState(false);
  const [picking, setPicking] = useState(false);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<{ id: string; name: string } | null>(null);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [chosen, setChosen] = useState<{ id: string; name: string } | null>(null);
  const [currentFolder, setCurrentFolder] = useState<{ id: string; name: string }>({ id: "root", name: "Meu Drive" });
  const [items, setItems] = useState<FileItem[]>([]);
  const [downloadsEnabled, setDownloadsEnabled] = useState(false);
  const [updatingPrefs, setUpdatingPrefs] = useState(false);
  const [newChangesCount, setNewChangesCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [peeking, setPeeking] = useState(false);
  const busyRef = useRef(false);
  const { toast } = useToast();

  const stateLabel = useMemo(() => {
    if (!status.ok) return "Erro";
    if ((status as any).connected) return "Conectado";
    const r = (status as any).reason?.toUpperCase() || "";
    if (r.includes("EXPIRED")) return "Expirado";
    if (r.includes("SCOPE")) return "Permissões pendentes";
    return "Desconectado";
  }, [status]);

  const needsScope = useMemo(() => {
    const r = (status as any).reason?.toUpperCase() || "";
    return r.includes("SCOPE");
  }, [status]);

  const hasSavedFolder = useMemo(() => {
    const s = status as any;
    return !!(chosen?.id || s?.dedicatedFolderId || s?.dedicated_folder_id || s?.driveFolderId || s?.drive_folder_id);
  }, [chosen, status]);

  const savedFolderName = useMemo(() => {
    const s = status as any;
    return chosen?.name || s?.dedicatedFolderName || s?.dedicated_folder_name || s?.driveFolderName || s?.drive_folder_name;
  }, [chosen, status]);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-drive-auth", { body: { action: "status" } });
      if (error || !data || typeof data !== 'object') {
        setStatus({ ok: false, reason: error?.message ? String(error.message) : "INVALID_RESPONSE" });
        toast({
          title: "Aviso",
          description: "Não foi possível obter o status atual",
          variant: "destructive",
        });
      } else {
        setStatus(data as DriveStatus);
        setDownloadsEnabled(!!(data as any).downloadsEnabled);
        // Update chosen folder from status if available
        if ((data as any).ok && (data as any).connected && (data as any).dedicatedFolderId) {
          setChosen({
            id: (data as any).dedicatedFolderId,
            name: (data as any).dedicatedFolderName || `Pasta ${(data as any).dedicatedFolderId}`
          });
        }
        if ((data as any).ok && (data as any).connected) {
          toast({
            title: "Status verificado",
            description: "Google Drive conectado com sucesso",
          });
        }
      }
    } catch (e) {
      setStatus({ ok: false, reason: "NETWORK_ERROR" });
      toast({
        title: "Erro",
        description: "Falha ao verificar status da conexão",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const authorize = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const { data } = await supabase.functions.invoke("google-drive-auth", {
        body: { action: "authorize", redirect: window.location.origin + "/settings/drive" }
      });
      const url = data?.authorizeUrl;
      if (url) {
        window.open(url, "_blank", "width=520,height=720");
        toast({
          title: "Redirecionando...",
          description: "Você será redirecionado para autorizar o Google Drive",
        });
      }
    } catch (e) {
      toast({
        title: "Erro",
        description: "Falha ao iniciar processo de autorização",
        variant: "destructive",
      });
    } finally {
      setTimeout(() => (busyRef.current = false), 500);
    }
  }, [toast]);

  const reconnectHard = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const { data } = await supabase.functions.invoke("google-drive-auth", {
        body: { action: "authorize", redirect: window.location.origin + "/settings/drive", forceConsent: true }
      });
      const url = data?.authorizeUrl;
      if (url) {
        window.open(url, "_blank", "width=520,height=720");
        toast({
          title: "Reconectando...",
          description: "Você será redirecionado para reconectar com novas permissões",
        });
      }
    } catch (e) {
      toast({
        title: "Erro",
        description: "Falha ao iniciar processo de reconexão",
        variant: "destructive",
      });
    } finally {
      setTimeout(() => (busyRef.current = false), 500);
    }
  }, [toast]);

  const peekChanges = useCallback(async () => {
    if (!status.ok || !(status as any).connected) return;
    
    setPeeking(true);
    try {
      const { data, error } = await supabase.functions.invoke("drive-changes-peek");
      if (error || !data) {
        console.warn("Failed to peek changes:", error);
        return;
      }
      
      setNewChangesCount(data.newCount || 0);
    } catch (e) {
      console.warn("Error peeking changes:", e);
    } finally {
      setPeeking(false);
    }
  }, [status]);

  // Diagnóstico temporário
  const runDiagnostics = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("drive-sync-diagnostics");
      if (error) throw error;
      
      const diag = data as any;
      console.log("🔍 DIAGNOSTICS", diag);
      
      toast({
        title: "Diagnóstico",
        description: (
          <div className="space-y-1 text-xs">
            <div><strong>Settings:</strong> {diag.settings?.folderId || 'null'}</div>
            <div><strong>State Root:</strong> {diag.state?.rootFolderId || 'null'}</div>
            <div><strong>Pending:</strong> {diag.state?.pending?.length || 0}</div>
            <div><strong>Status:</strong> {diag.state?.status || 'null'}</div>
            <div className="text-muted-foreground mt-2">TraceID: {diag.traceId}</div>
          </div>
        ),
        duration: 8000,
      });
      
      return diag;
    } catch (e) {
      toast({
        title: "Erro no diagnóstico",
        description: e instanceof Error ? e.message : "Falha ao obter diagnóstico",
        variant: "destructive",
      });
      return null;
    }
  }, [toast]);

  const syncNow = useCallback(async () => {
    if (!status.ok || !(status as any).connected) return;
    
    setSyncing(true);
    let totalProcessed = 0;
    
    try {
      // (a) SEMPRE rearmar o root com drive-sync-start
      console.log("🔄 Step 1: Starting sync (drive-sync-start)...");
      const { data: startData, error: startErr } = await supabase.functions.invoke("drive-sync-start");
      if (startErr) throw new Error(`Falha ao iniciar sync: ${startErr.message}`);
      console.log("✅ Sync started:", startData);
      
      // (b) Verificar se precisa indexar (diagnostics.pending === 0)
      console.log("🔍 Step 2: Checking if indexing is needed...");
      const diag = await runDiagnostics();
      const needsIndex = !diag?.state?.pending || diag.state.pending.length === 0;
      
      if (needsIndex) {
        console.log("📁 Step 2b: Running initial index (drive-index-folder)...");
        toast({
          title: "Indexando pasta...",
          description: "Primeira sincronização, indexando conteúdo da pasta",
        });
        
        const { data: indexData, error: indexErr } = await supabase.functions.invoke("drive-index-folder");
        if (indexErr) throw new Error(`Falha na indexação: ${indexErr.message}`);
        console.log("✅ Index completed:", indexData);
      }
      
      // (c) Loop drive-sync-run até zerar pending
      console.log("⚙️ Step 3: Running sync batches (drive-sync-run)...");
      let attempts = 0;
      const MAX_ATTEMPTS = 50; // Limite de segurança
      
      while (attempts < MAX_ATTEMPTS) {
        attempts++;
        console.log(`📦 Sync run attempt ${attempts}...`);
        
        const { data: runData, error: runErr } = await supabase.functions.invoke("drive-sync-run", {
          body: { budgetFolders: 5 }
        });
        
        // Tratar 401 TOKEN_EXPIRED - disparar reauth
        if (runErr && (runErr.message?.includes("401") || runErr.message?.includes("TOKEN_EXPIRED"))) {
          console.warn("🔑 Token expired, triggering reauth...");
          toast({
            title: "Token expirado",
            description: "Reconectando sua conta do Google Drive...",
          });
          
          // Disparar fluxo OAuth novamente
          const { data: authData } = await supabase.functions.invoke("google-drive-auth", {
            body: { action: "authorize", redirect: window.location.origin + "/settings/drive" }
          });
          
          if (authData?.authorizeUrl) {
            window.open(authData.authorizeUrl, "_blank", "width=520,height=720");
          }
          throw new Error("Token expirado. Por favor, reconecte sua conta.");
        }
        
        // Tratar 409 ROOT_MISMATCH
        if (runErr && runErr.message?.includes("409")) {
          console.warn("⚠️ ROOT_MISMATCH detected, re-arming...");
          toast({
            title: "Pasta alterada",
            description: "Rearmando sincronização...",
          });
          
          // Rearmar e tentar novamente (com backoff curto)
          await new Promise(resolve => setTimeout(resolve, 1000));
          await supabase.functions.invoke("drive-sync-start");
          continue;
        }
        
        if (runErr) throw new Error(`Falha no sync run: ${runErr.message}`);
        
        const processed = (runData as any)?.updatedItems || 0;
        const queued = (runData as any)?.queued || 0;
        const done = (runData as any)?.done || false;
        
        totalProcessed += processed;
        console.log(`✅ Batch ${attempts}: processed=${processed}, queued=${queued}, done=${done}`);
        
        if (done || queued === 0) {
          console.log("🎉 Sync complete!");
          break;
        }
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      toast({
        title: "Sincronização concluída",
        description: `${totalProcessed} itens processados em ${attempts} lotes`,
      });
      
      // Reset count after sync
      setNewChangesCount(0);
      
      // Dispatch event to update home
      window.dispatchEvent(new CustomEvent('google-drive-status-changed'));
      
    } catch (e) {
      toast({
        title: "Erro na sincronização",
        description: e instanceof Error ? e.message : "Falha ao sincronizar",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  }, [status, toast, runDiagnostics]);

  const disconnect = useCallback(async () => {
    setLoading(true);
    try {
      await supabase.functions.invoke("google-drive-auth", { body: { action: "disconnect" } });
      await fetchStatus();
      toast({
        title: "Desconectado",
        description: "Google Drive desconectado com sucesso",
      });
    } catch (e) {
      toast({
        title: "Erro",
        description: "Falha ao desconectar Google Drive",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [fetchStatus, toast]);

  const openFolderPicker = useCallback(() => {
    setShowFolderPicker(true);
  }, []);

  const handleFolderSelected = useCallback((folder: { id: string; name: string }) => {
    setSelectedFolder(folder);
    toast({
      title: "Pasta selecionada",
      description: `Pasta "${folder.name}" selecionada com sucesso`,
    });
  }, [toast]);

  const toggleDownloads = useCallback(async (enabled: boolean) => {
    setUpdatingPrefs(true);
    try {
      // Primeiro, atualizar a preferência
      await supabase.functions.invoke("google-drive-auth", {
        body: { action: "set_prefs", allowExtendedScope: enabled }
      });

      if (enabled) {
        // Se está ligando, também precisa reconectar para obter o novo escopo
        const { data } = await supabase.functions.invoke("google-drive-auth", {
          body: { action: "authorize", redirect: window.location.origin + "/settings/drive" }
        });
        const url = data?.authorizeUrl;
        if (url) {
          window.open(url, "_blank", "width=520,height=720");
          toast({
            title: "Reconectando...",
            description: "Você será redirecionado para autorizar os downloads",
          });
        }
      } else {
        // Se está desligando, apenas atualizar o estado local
        setDownloadsEnabled(false);
        toast({
          title: "Downloads desabilitados",
          description: "Downloads pelo app foram desabilitados",
        });
      }
    } catch (e) {
      toast({
        title: "Erro",
        description: "Falha ao atualizar preferências de download",
        variant: "destructive",
      });
    } finally {
      setUpdatingPrefs(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchStatus();
    
    // Peek changes when connected
    if (status.ok && (status as any).connected) {
      peekChanges();
    }
  }, [fetchStatus, peekChanges, status]);

  // Debug log para verificar o estado chosen
  useEffect(() => {
    console.log("=== DEBUG SYNC SECTION ===");
    console.log("Status:", status);
    console.log("Chosen:", chosen);
    console.log("hasSavedFolder:", hasSavedFolder);
    console.log("savedFolderName:", savedFolderName);
    console.log("Should show sync section:", (status.ok && (status as any).connected && hasSavedFolder));
    console.log("========================");
  }, [chosen, status, hasSavedFolder, savedFolderName]);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e?.data?.type === "drive_connected") {
        toast({
          title: "Conectado!",
          description: "Google Drive conectado com sucesso",
        });
        fetchStatus();
        // Peek changes after connection
        setTimeout(peekChanges, 1000);
      } else if (e?.data?.type === "drive_connect_error") {
        toast({
          title: "Erro na conexão",
          description: "Falha ao conectar com o Google Drive",
          variant: "destructive",
        });
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [fetchStatus, peekChanges, toast]);

  const getStatusBadgeVariant = () => {
    if (!status.ok) return "destructive";
    if ((status as any).connected) return "default";
    const r = (status as any).reason?.toUpperCase() || "";
    if (r.includes("EXPIRED")) return "secondary";
    return "outline";
  };

  const getStatusIcon = () => {
    if (!status.ok) return <AlertCircle className="h-3 w-3" />;
    if ((status as any).connected) return <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse" />;
    return <div className="h-3 w-3 bg-gray-400 rounded-full" />;
  };

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Configurações › Google Drive</h1>
        <p className="text-muted-foreground">
          Conecte e gerencie sua integração com o Google Drive para backup e sincronização de fotos.
        </p>
      </div>

      {needsScope && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <Settings className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-medium text-blue-800 mb-1">Novas Permissões Necessárias</h4>
                <p className="text-sm text-blue-700 mb-3">
                  Para acessar suas pastas do Google Drive, você precisa reconectar 
                  com as novas permissões de leitura de metadados.
                </p>
                <Button
                  onClick={authorize}
                  disabled={loading || busyRef.current}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {(loading || busyRef.current) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reconectar com Permissões
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-6 w-6" />
            Integração Google Drive
            {newChangesCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                Novos: {newChangesCount}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Status da conexão e gerenciamento da integração
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Status:</span>
              {getStatusIcon()}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={getStatusBadgeVariant()} className="flex items-center gap-1">
                {stateLabel}
                {loading && <Loader2 className="h-3 w-3 animate-spin" />}
              </Badge>
              {peeking && <Loader2 className="h-3 w-3 animate-spin" />}
            </div>
          </div>

          {/* Sync Section */}
          {(status.ok && (status as any).connected) && (
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Sincronização</span>
                  {newChangesCount > 0 && (
                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                      {newChangesCount} novos itens
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {newChangesCount > 0 
                    ? `Há ${newChangesCount} novos itens para sincronizar` 
                    : "Seus arquivos estão sincronizados"
                  }
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={runDiagnostics}
                  variant="ghost"
                  size="sm"
                  disabled={syncing}
                  className="flex items-center gap-2"
                  title="Diagnóstico técnico (temporário)"
                >
                  <Settings className="h-4 w-4" />
                  Diagnóstico
                </Button>
                <Button
                  onClick={peekChanges}
                  variant="outline"
                  size="sm"
                  disabled={peeking || syncing}
                  className="flex items-center gap-2"
                >
                  {peeking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Verificar
                </Button>
                <Button
                  onClick={syncNow}
                  variant={newChangesCount > 0 ? "default" : "outline"}
                  size="sm"
                  disabled={syncing || peeking}
                  className="flex items-center gap-2"
                >
                  {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Sincronizar agora
                </Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Button
              onClick={fetchStatus}
              variant="outline"
              disabled={loading}
              className="flex items-center gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Verificar Status
            </Button>
            
            {/* Mostrar botão Conectar apenas se NÃO estiver conectado */}
            {!(status.ok && (status as any).connected) && (
              <Button
                onClick={authorize}
                variant="outline"
                disabled={loading || busyRef.current}
                className="flex items-center gap-2 border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800"
              >
                {(loading || busyRef.current) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}
                Conectar
              </Button>
            )}
            
            {/* Hidden reconnect with permissions button */}
            <Button
              onClick={reconnectHard}
              variant="outline"
              disabled={loading || busyRef.current}
              className="hidden flex items-center gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"
            >
              {(loading || busyRef.current) ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Reconectar com permissões
            </Button>
            
            <Button
              onClick={() => setBrowserOpen((v) => !v)}
              variant="outline"
              disabled={!status.ok || !(status as any).connected}
              className="flex items-center gap-2"
            >
              <Folder className="h-4 w-4" />
              {browserOpen ? "Ocultar pastas" : "Selecionar Pasta"}
            </Button>
            
            <Button
              onClick={() => {
                toast({
                  title: "Em breve",
                  description: "Funcionalidade de sincronização de pasta em desenvolvimento",
                });
              }}
              variant="outline"
              disabled={!status.ok || !(status as any).connected}
              className="flex items-center gap-2 border-green-200 text-green-700 hover:bg-green-50"
            >
              <RefreshCw className="h-4 w-4" />
              Sincronizar pasta
            </Button>
            
            {/* Mostrar botão Desconectar apenas se estiver conectado */}
            {(status.ok && (status as any).connected) && (
              <Button
                onClick={disconnect}
                variant="outline"
                disabled={loading}
                className="flex items-center gap-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />}
                Desconectar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preferências do Usuário */}
      {(status.ok && (status as any).connected) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Preferências de Download
            </CardTitle>
            <CardDescription>
              Configure as permissões para download de arquivos do Google Drive
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Permitir downloads pelo app</span>
                  {downloadsEnabled && <Badge variant="outline" className="text-xs">Ativo</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  Habilita o download de arquivos diretamente do Google Drive através do aplicativo
                </p>
              </div>
              <Switch
                checked={downloadsEnabled}
                onCheckedChange={toggleDownloads}
                disabled={updatingPrefs || loading}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status da Pasta Selecionada */}
      {(status.ok && (status as any).connected) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Folder className="h-5 w-5" />
              Pasta Dedicada para Backup
            </CardTitle>
            <CardDescription>
              {savedFolderName ? `Pasta atual: ${savedFolderName}` : "Nenhuma pasta foi selecionada ainda"}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Sincronização da Pasta de Backup */}
      {(status.ok && (status as any).connected && hasSavedFolder) && (
        <Card className="border-green-200 bg-green-50/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <RefreshCw className="h-5 w-5" />
              Sincronização de Arquivos
            </CardTitle>
            <CardDescription className="text-green-700">
              Sincronize os arquivos da pasta de backup: <strong>{savedFolderName}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => {
                console.log("Botão Sincronizar clicado - Pasta:", savedFolderName);
                toast({
                  title: "Em breve",
                  description: "Funcionalidade de sincronização em desenvolvimento",
                });
              }}
              className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Sincronizar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Navegador de Pastas */}
      {(status.ok && (status as any).connected) && (
        <DriveBrowser onFolderSelected={(folder) => {
          setChosen(folder);
          toast({
            title: "Pasta selecionada",
            description: `Pasta "${folder.name}" foi definida como pasta de backup`,
          });
        }} />
      )}

      {/* Modal do Folder Picker */}
      <FolderPickerModal
        open={showFolderPicker}
        onClose={() => setShowFolderPicker(false)}
        onPicked={handleFolderSelected}
      />

      {/* Smoke Tests */}
      <GoogleDriveSmokeTests />
    </div>
  );
}