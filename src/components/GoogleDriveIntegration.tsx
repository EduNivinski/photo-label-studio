import React, { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useGoogleDriveSimple } from "@/hooks/useGoogleDriveSimple";
import { useToast } from "@/hooks/use-toast";
import { DriveIntegrationCard } from "./DriveIntegrationCard";
import { DriveBrowserCard } from "./DriveBrowserCard";

export default function GoogleDriveIntegration() {
  const { status, loading, checkStatus, connect, disconnect } = useGoogleDriveSimple();
  const { toast } = useToast();
  const [showFolderBrowser, setShowFolderBrowser] = useState(false);

  const handleConnect = async () => {
    await connect();
  };

  const handleDisconnect = async () => {
    await disconnect();
  };

  const handleReconnect = async () => {
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

  const handleSelectCurrentFolder = useCallback(async (id: string, name: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("google-drive-auth", {
        body: { action: "set_folder", folderId: id, folderName: name }
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
    if (!status.dedicatedFolder) return null;
    // Por simplicidade, apenas mostrar o nome da pasta dedicada
    // Pode ser expandido para mostrar o path completo baseado no breadcrumb
    return typeof status.dedicatedFolder === 'string' 
      ? status.dedicatedFolder 
      : status.dedicatedFolder.name;
  }, [status.dedicatedFolder]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <DriveIntegrationCard
        state={getStatusState()}
        dedicatedFolderPath={buildFolderPath()}
        onCheck={checkStatus}
        onReconnect={handleReconnect}
        onReconnectWithConsent={handleReconnectWithPermissions}
        onDisconnect={handleDisconnect}
        onChooseFolder={() => setShowFolderBrowser(true)}
      />

      {!status.isConnected && (
        <div className="text-center py-8">
          <h3 className="text-lg font-medium mb-2">Conectar ao Google Drive</h3>
          <p className="text-muted-foreground mb-6">
            Conecte sua conta do Google Drive para fazer backup e importar suas fotos
          </p>
        </div>
      )}

      {/* Navegador de Pastas */}
      {showFolderBrowser && (
        <DriveBrowserCard
          onSelectCurrentFolder={handleSelectCurrentFolder}
        />
      )}
    </div>
  );
}