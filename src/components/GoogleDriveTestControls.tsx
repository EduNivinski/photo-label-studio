import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Folder, FileText, RefreshCw, Plus, Link as LinkIcon, Unlink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useGoogleDriveSimple } from '@/hooks/useGoogleDriveSimple';

export const GoogleDriveTestControls = () => {
  const { toast } = useToast();
  const { status, loading: statusLoading, checkStatus } = useGoogleDriveSimple();
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [folderFiles, setFolderFiles] = useState<any[]>([]);
  const [driveStatus, setDriveStatus] = useState<any>(null);

  // Listen for popup messages from Google Drive OAuth
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e?.data?.source === "gdrive-oauth") {
        supabase.functions.invoke("google-drive-auth", { body: { action: "status" } })
          .then(r => setDriveStatus(r.data));
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // Initialize drive status
  useEffect(() => {
    if (status) {
      setDriveStatus(status);
    }
  }, [status]);

  const handleAction = async (actionName: string, action: () => Promise<void>) => {
    setLoading(prev => ({ ...prev, [actionName]: true }));
    try {
      await action();
    } catch (error) {
      console.error(`Error in ${actionName}:`, error);
      toast({
        title: "Erro",
        description: `Falha na operação: ${actionName}`,
        variant: "destructive"
      });
    } finally {
      setLoading(prev => ({ ...prev, [actionName]: false }));
    }
  };

  const connectGoogleDrive = async () => {
    const result = await supabase.functions.invoke("google-drive-auth", { 
      body: { action: "authorize", redirect: window.location.origin + "/user" }
    });
    
    if (result.data?.authorizeUrl) {
      const popup = window.open(result.data.authorizeUrl, "gdrive-auth", "width=500,height=600");
      // Popup will send message when auth completes
    } else {
      toast({
        title: "Erro na autorização",
        description: result.data?.reason || "Erro desconhecido",
        variant: "destructive"
      });
    }
  };

  const reverifyStatus = async () => {
    const result = await supabase.functions.invoke("google-drive-auth", { 
      body: { action: "status" } 
    });
    setDriveStatus(result.data);
    toast({
      title: "Status atualizado",
      description: "Status do Google Drive verificado",
    });
  };

  const ensureDedicatedFolder = async () => {
    const result = await supabase.functions.invoke("google-drive-api", { 
      body: { action: "ensureDedicatedFolder" } 
    });
    
    console.log("ensureDedicatedFolder:", result.data || result.error);
    
    if (result.data?.ok) {
      toast({
        title: "Pasta criada/garantida",
        description: `Pasta: ${result.data.dedicatedFolderName}`,
      });
      // Refresh status to update UI
      await reverifyStatus();
    } else {
      toast({
        title: "Erro na pasta dedicada",
        description: result.data?.reason || "Erro desconhecido",
        variant: "destructive"
      });
    }
  };

  const createSampleFile = async () => {
    const dedicatedFolderId = driveStatus?.dedicatedFolder?.id || status?.dedicatedFolder?.id;
    if (!dedicatedFolderId) {
      toast({
        title: "Pasta não encontrada",
        description: "Crie a pasta dedicada primeiro",
        variant: "destructive"
      });
      return;
    }

    const result = await supabase.functions.invoke("google-drive-api", {
      body: { 
        action: "createSampleFile",
        parentId: dedicatedFolderId
      }
    });
    
    console.log("createSampleFile:", result.data || result.error);
    
    if (result.data?.ok) {
      toast({
        title: "Arquivo criado",
        description: `Arquivo: ${result.data.name}`,
      });
      // Refresh folder list
      await loadFolderFiles();
    } else {
      toast({
        title: "Erro ao criar arquivo",
        description: result.data?.reason || "Erro desconhecido",
        variant: "destructive"
      });
    }
  };

  const loadFolderFiles = async () => {
    const dedicatedFolderId = driveStatus?.dedicatedFolder?.id || status?.dedicatedFolder?.id;
    if (!dedicatedFolderId) {
      toast({
        title: "Pasta não encontrada",
        description: "Crie a pasta dedicada primeiro",
        variant: "destructive"
      });
      return;
    }

    const result = await supabase.functions.invoke("google-drive-api", {
      body: { 
        action: "listFolder",
        folderId: dedicatedFolderId
      }
    });
    
    console.log("folder items:", result.data || result.error);
    
    if (result.data?.ok) {
      setFolderFiles(result.data.files || []);
      toast({
        title: "Lista atualizada",
        description: `${result.data.files?.length || 0} itens encontrados`,
      });
    } else {
      toast({
        title: "Erro ao listar",
        description: result.data?.reason || "Erro desconhecido",
        variant: "destructive"
      });
    }
  };

  const disconnectGoogleDrive = async () => {
    const result = await supabase.functions.invoke("google-drive-auth", { 
      body: { action: "disconnect" } 
    });
    
    if (result.data?.ok) {
      setDriveStatus(null);
      setFolderFiles([]);
      toast({
        title: "Desconectado",
        description: "Google Drive desconectado com sucesso",
      });
    } else {
      toast({
        title: "Erro ao desconectar",
        description: result.data?.reason || "Erro desconhecido",
        variant: "destructive"
      });
    }
  };

  const currentStatus = driveStatus || status;
  const isConnected = currentStatus?.isConnected || false;
  const dedicatedFolder = currentStatus?.dedicatedFolder;

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Folder className="h-5 w-5" />
        Google Drive Integration
      </h3>

      {/* Status Indicator */}
      <div className="mb-6 p-4 bg-muted rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Drive:</span>
          <Badge variant={isConnected ? "default" : "secondary"}>
            {isConnected ? "✅ Conectado" : "❌ Desconectado"}
          </Badge>
        </div>
        
        {isConnected && dedicatedFolder && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Pasta Dedicada:</span>
              <span className="text-sm font-medium">{dedicatedFolder.name}</span>
            </div>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={() => window.open(`https://drive.google.com/drive/folders/${dedicatedFolder.id}`, '_blank')}
            >
              <LinkIcon className="h-3 w-3 mr-1" />
              Abrir no Drive
            </Button>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        {!isConnected ? (
          <Button
            onClick={() => handleAction('connect', connectGoogleDrive)}
            disabled={loading.connect}
            className="w-full justify-start gap-2"
            variant="default"
          >
            {loading.connect ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
            ) : (
              <LinkIcon className="h-4 w-4" />
            )}
            Conectar Google Drive
          </Button>
        ) : (
          <>
            <Button
              onClick={() => handleAction('reverify', reverifyStatus)}
              disabled={loading.reverify}
              className="w-full justify-start gap-2"
              variant="outline"
            >
              {loading.reverify ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Reverificar Status
            </Button>

            <Button
              onClick={() => handleAction('ensureFolder', ensureDedicatedFolder)}
              disabled={loading.ensureFolder}
              className="w-full justify-start gap-2"
              variant="outline"
            >
              {loading.ensureFolder ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Criar/Garantir Pasta
            </Button>

            <Button
              onClick={() => handleAction('createFile', createSampleFile)}
              disabled={!dedicatedFolder?.id || loading.createFile}
              className="w-full justify-start gap-2"
              variant="outline"
            >
              {loading.createFile ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              Criar Arquivo de Teste
            </Button>

            <Button
              onClick={() => handleAction('loadFiles', loadFolderFiles)}
              disabled={!dedicatedFolder?.id || loading.loadFiles}
              className="w-full justify-start gap-2"
              variant="outline"
            >
              {loading.loadFiles ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Listar Conteúdo da Pasta
            </Button>

            <Button
              onClick={() => handleAction('disconnect', disconnectGoogleDrive)}
              disabled={loading.disconnect}
              className="w-full justify-start gap-2"
              variant="destructive"
            >
              {loading.disconnect ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
              ) : (
                <Unlink className="h-4 w-4" />
              )}
              Desconectar
            </Button>
          </>
        )}
      </div>

      {/* Lista de Arquivos */}
      {folderFiles.length > 0 && (
        <div className="mt-6">
          <h4 className="font-medium mb-3">Arquivos na Pasta Dedicada ({folderFiles.length}):</h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {folderFiles.map((file: any, index: number) => (
              <div 
                key={file.id || index} 
                className="flex items-center gap-2 p-2 bg-muted rounded text-sm"
              >
                {file.mimeType === 'application/vnd.google-apps.folder' ? (
                  <Folder className="h-4 w-4 text-blue-500" />
                ) : (
                  <FileText className="h-4 w-4 text-gray-500" />
                )}
                <span className="flex-1 truncate">{file.name}</span>
                <Badge variant="secondary" className="text-xs">
                  {file.mimeType?.replace('application/vnd.google-apps.', '') || 'file'}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};