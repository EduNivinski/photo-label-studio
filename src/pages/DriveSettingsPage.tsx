import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Cloud, Folder, Unplug, RefreshCw, Settings, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import FolderPickerModal from "@/components/Drive/FolderPickerModal";
import FolderBrowserCard from "@/components/Drive/FolderBrowserCard";

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
              onClick={() => setBrowserOpen((v) => !v)}
              variant="outline"
              disabled={!status.ok || !(status as any).connected}
              className="flex items-center gap-2"
            >
              <Folder className="h-4 w-4" />
              {browserOpen ? "Ocultar pastas" : "Escolher Pasta"}
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

      {/* Navegador de Pastas Inline */}
      {(status.ok && (status as any).connected) && (
        <div className="rounded-xl border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Navegador de Pastas</h3>
            <Button
              onClick={() => setBrowserOpen((v) => !v)}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <Folder className="h-4 w-4" />
              {browserOpen ? "Ocultar pastas" : "Escolher Pasta"}
            </Button>
          </div>

          {chosen && (
            <div className="text-xs text-gray-600 p-2 bg-gray-50 rounded">
              Pasta selecionada: <span className="font-medium">{chosen.name}</span> ({chosen.id})
            </div>
          )}

          <FolderBrowserCard
            open={browserOpen}
            onClose={() => setBrowserOpen(false)}
            onPicked={(f) => { setChosen(f); setBrowserOpen(false); toast({ title: "Pasta selecionada", description: `"${f.name}" foi selecionada` }); }}
          />
        </div>
      )}

      {/* Modal do Folder Picker */}
      <FolderPickerModal
        open={showFolderPicker}
        onClose={() => setShowFolderPicker(false)}
        onPicked={handleFolderSelected}
      />
    </div>
  );
}