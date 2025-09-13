import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Cloud, Folder, Unplug, RefreshCw, Settings, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type DriveStatus =
  | { ok: true; connected: true }
  | { ok: true; connected: false; reason?: string }
  | { ok: false; reason: string };

type FileItem = { id: string; name: string; mimeType?: string };

export default function DriveSettingsPage() {
  const [status, setStatus] = useState<DriveStatus>({ ok: true, connected: false });
  const [loading, setLoading] = useState(false);
  const [picking, setPicking] = useState(false);
  const [currentFolder, setCurrentFolder] = useState<{ id: string; name: string }>({ id: "root", name: "Meu Drive" });
  const [items, setItems] = useState<FileItem[]>([]);
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

  const openPicker = useCallback(async (folderId = currentFolder.id, folderName = currentFolder.name) => {
    setPicking(true);
    setCurrentFolder({ id: folderId, name: folderName });
    try {
      const { data, error } = await supabase.functions.invoke("diag-list-folder", { body: { folderId } });
      if (!error && data?.files) {
        setItems(data.files as FileItem[]);
        toast({
          title: "Pasta carregada",
          description: `Conteúdo de "${folderName}" carregado com sucesso`,
        });
      } else {
        toast({
          title: "Erro",
          description: "Falha ao carregar conteúdo da pasta",
          variant: "destructive",
        });
      }
    } catch (e) {
      toast({
        title: "Erro",
        description: "Falha ao listar arquivos da pasta",
        variant: "destructive",
      });
    } finally {
      setPicking(false);
    }
  }, [currentFolder.id, currentFolder.name, toast]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // ouvir o callback
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e?.data?.type === "drive_connected") {
        toast({
          title: "Conectado!",
          description: "Google Drive conectado com sucesso",
        });
        fetchStatus();
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
  }, [fetchStatus, toast]);

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
            <Badge variant={getStatusBadgeVariant()} className="flex items-center gap-1">
              {stateLabel}
              {loading && <Loader2 className="h-3 w-3 animate-spin" />}
            </Badge>
          </div>

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
            
            <Button
              onClick={authorize}
              variant="outline"
              disabled={loading || busyRef.current}
              className="flex items-center gap-2"
            >
              {(loading || busyRef.current) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}
              {(status as any).connected ? 'Reconectar' : 'Conectar'}
            </Button>
            
            <Button
              onClick={() => openPicker("root", "Meu Drive")}
              variant="outline"
              disabled={!status.ok || !(status as any).connected || picking}
              className="flex items-center gap-2"
            >
              {picking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Folder className="h-4 w-4" />}
              Escolher Pasta
            </Button>
            
            <Button
              onClick={disconnect}
              variant="outline"
              disabled={loading || !status.ok || !(status as any).connected}
              className="flex items-center gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />}
              Desconectar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Gerenciamento de Pastas */}
      {(status.ok && (status as any).connected) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Folder className="h-5 w-5" />
              Gerenciamento de Pastas
            </CardTitle>
            <CardDescription>
              Navegue e selecione pastas do seu Google Drive
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <Folder className="h-4 w-4" />
                <span className="text-sm font-medium">Pasta atual:</span>
              </div>
              <Badge variant="outline" className="text-xs">
                {currentFolder.name}
              </Badge>
            </div>

            <div className="space-y-2">
              <Button
                onClick={() => openPicker("root", "Meu Drive")}
                variant="link"
                className="text-sm p-0 h-auto"
                disabled={picking}
              >
                📁 Ir para raiz (Meu Drive)
              </Button>
              
              {picking ? (
                <div className="flex items-center gap-2 p-4 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Carregando conteúdo da pasta...</span>
                </div>
              ) : (
                <div className="border rounded-lg">
                  {items.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground text-sm">
                      Pasta vazia ou erro ao carregar
                    </div>
                  ) : (
                    <div className="divide-y">
                      {items.map(item => (
                        <div key={item.id} className="p-3 flex items-center justify-between hover:bg-muted/50">
                          <div className="flex items-center gap-2">
                            {item.mimeType === "application/vnd.google-apps.folder" ? (
                              <Folder className="h-4 w-4 text-blue-500" />
                            ) : (
                              <div className="h-4 w-4 bg-gray-300 rounded" />
                            )}
                            <span className="text-sm font-medium">{item.name}</span>
                          </div>
                          {item.mimeType === "application/vnd.google-apps.folder" ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openPicker(item.id, item.name)}
                              className="text-xs"
                            >
                              Abrir pasta
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">arquivo</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}