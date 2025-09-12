import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Folder, FileText, RefreshCw, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useGoogleDriveSimple } from '@/hooks/useGoogleDriveSimple';

export const GoogleDriveTestControls = () => {
  const { toast } = useToast();
  const { status, loading: statusLoading, checkStatus } = useGoogleDriveSimple();
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [folderFiles, setFolderFiles] = useState<any[]>([]);

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
      await checkStatus();
    } else {
      toast({
        title: "Erro na pasta dedicada",
        description: result.data?.reason || "Erro desconhecido",
        variant: "destructive"
      });
    }
  };

  const createSampleFile = async () => {
    if (!status?.dedicatedFolder?.id) {
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
        parentId: status.dedicatedFolder.id
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
    if (!status?.dedicatedFolder?.id) {
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
        folderId: status.dedicatedFolder.id
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

  if (!status?.isConnected) {
    return (
      <Card className="p-4">
        <p className="text-muted-foreground text-center">
          Conecte-se ao Google Drive primeiro para usar estes controles.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Folder className="h-5 w-5" />
        Controles de Teste do Google Drive
      </h3>

      {/* Status da Pasta Dedicada */}
      <div className="mb-4 p-3 bg-muted rounded-lg">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Status da Pasta Dedicada:</span>
          {status.dedicatedFolder ? (
            <Badge variant="default">
              ✅ {status.dedicatedFolder.name}
            </Badge>
          ) : (
            <Badge variant="secondary">
              ⚠️ Não configurada
            </Badge>
          )}
        </div>
      </div>

      {/* Botões de Ação */}
      <div className="space-y-3">
        <Button
          onClick={() => handleAction('ensureFolder', ensureDedicatedFolder)}
          disabled={loading.ensureFolder || statusLoading}
          className="w-full justify-start gap-2"
          variant="outline"
        >
          {loading.ensureFolder ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Criar/Garantir Pasta Dedicada
        </Button>

        <Button
          onClick={() => handleAction('createFile', createSampleFile)}
          disabled={!status?.dedicatedFolder?.id || loading.createFile}
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
          disabled={!status?.dedicatedFolder?.id || loading.loadFiles}
          className="w-full justify-start gap-2"
          variant="outline"
        >
          {loading.loadFiles ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Recarregar Lista de Arquivos
        </Button>
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