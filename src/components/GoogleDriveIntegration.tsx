import React, { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useGoogleDriveSimple } from "@/hooks/useGoogleDriveSimple";
import { useToast } from "@/hooks/use-toast";
import { DriveIntegrationCard } from "./DriveIntegrationCard";
import { DriveBrowserCard } from "./DriveBrowserCard";
import { useDriveBrowser } from "@/hooks/useDriveBrowser";

export default function GoogleDriveIntegration() {
  const { status, loading, checkStatus, connect, disconnect } = useGoogleDriveSimple();
  const { toast } = useToast();
  const [showFolderBrowser, setShowFolderBrowser] = useState(false);
  const { current, items, loading: browserLoading, err, list, enter, back } = useDriveBrowser();

  const handleConnect = async () => {
    await connect();
  };

  const handleDisconnect = async () => {
    await disconnect();
  };

  const handleReconnectWithPermissions = async () => {
    await disconnect();
    setTimeout(() => {
      handleConnect();
    }, 1000);
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

  const buildFolderPath = useCallback(() => {
    if (!status.dedicatedFolder) return null;
    // Por simplicidade, apenas mostrar o nome da pasta dedicada
    // Pode ser expandido para mostrar o path completo baseado no breadcrumb
    return typeof status.dedicatedFolder === 'string' 
      ? status.dedicatedFolder 
      : status.dedicatedFolder.name;
  }, [status.dedicatedFolder]);

  const getStatusState = useCallback(() => {
    if (loading) return "checking";
    if (!status.isConnected) return "disconnected";
    if (status.isExpired) return "error";
    return "connected";
  }, [loading, status.isConnected, status.isExpired]);

  const handleSelectCurrentFolder = useCallback(async () => {
    const currentFolderName = current === "root" ? "Meu Drive" : 
                             items.find(item => item.id === current)?.name || "Pasta atual";
    
    try {
      const { data, error } = await supabase.functions.invoke("google-drive-auth", {
        body: { action: "set_folder", folderId: current, folderName: currentFolderName }
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
  }, [current, items, toast, checkStatus]);

  const buildBreadcrumbPath = useCallback(() => {
    // Converter a pilha de navegação em breadcrumb
    // Por simplicidade, começamos com "Meu Drive"
    const path = [{ id: "root", name: "Meu Drive" }];
    
    // Aqui poderíamos adicionar os folders intermediários se tivéssemos o histórico
    // Por agora, apenas mostrar o current se não for root
    if (current !== "root") {
      const currentItem = items.find(item => item.id === current);
      if (currentItem) {
        path.push({ id: current, name: currentItem.name });
      }
    }
    
    return path;
  }, [current, items]);

  // Inicializar browser quando mostrar
  useEffect(() => {
    if (showFolderBrowser) {
      list(true);
    }
  }, [showFolderBrowser, list]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <DriveIntegrationCard
        state={getStatusState()}
        dedicatedFolderPath={buildFolderPath()}
        onCheck={checkStatus}
        onReconnect={status.isConnected ? handleReconnectWithPermissions : handleConnect}
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
          path={buildBreadcrumbPath()}
          items={items}
          canGoBack={current !== "root"}
          onBack={back}
          onOpenFolder={enter}
          onSelectCurrentFolder={handleSelectCurrentFolder}
        />
      )}
    </div>
  );
}