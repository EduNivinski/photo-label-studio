import { useCallback, useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import { Check, Folder, Loader2, RefreshCw, Users, Wrench } from "lucide-react";
import { useGoogleDrive } from "../hooks/useGoogleDrive";
import { GoogleDriveFolder } from "../hooks/useGoogleDrive";

interface GoogleDriveFolderSelectorProps {
  onFolderSelected: () => void;
  onClose: () => void;
}

export default function GoogleDriveFolderSelector({ onFolderSelected, onClose }: GoogleDriveFolderSelectorProps) {
  const { listFolders, setDedicatedFolder, loading, runDiagnostics } = useGoogleDrive();
  const [folders, setFolders] = useState<GoogleDriveFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<GoogleDriveFolder | null>(null);
  const [fetchingFolders, setFetchingFolders] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sharedDrives, setSharedDrives] = useState<any[]>([]);

  const fetchFolders = useCallback(async (includeSharedDrives: boolean = false) => {
    try {
      setFetchingFolders(true);
      setError(null);
      console.log('🚀 Starting to fetch folders...');
      const { folders, sharedDrives } = await listFolders(undefined, includeSharedDrives);
      console.log('📋 Received folders:', folders);
      setFolders(folders);
      setSharedDrives(sharedDrives);
    } catch (error) {
      console.error('❌ Error fetching folders:', error);
      setError(error instanceof Error ? error.message : 'Erro desconhecido');
      setFolders([]);
      setSharedDrives([]);
    } finally {
      setFetchingFolders(false);
    }
  }, [listFolders]);

  const handleDiagnostics = useCallback(async () => {
    try {
      const diagnostics = await runDiagnostics();
      console.log('🔧 Diagnostics:', diagnostics);
      
      // Handle new diagnostic format
      if (diagnostics.scopes?.success === false) {
        setError(`Erro nos escopos: ${diagnostics.scopes.error}`);
      } else if (diagnostics.listing?.success === false) {
        setError(`Erro na listagem: ${diagnostics.listing.error}`);  
      } else if (!diagnostics.scopes?.data?.hasRequiredScopes) {
        setError('Escopos insuficientes. Reconecte com novas permissões.');
      } else if (diagnostics.listing?.data?.filesCount === 0) {
        setError('Nenhuma pasta encontrada. Verifique permissões ou crie pastas no Google Drive.');
      }
    } catch (error) {
      console.error('❌ Error running diagnostics:', error);
      setError('Falha ao executar diagnósticos');
    }
  }, [runDiagnostics]);

  // Fetch folders when component mounts
  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  const handleFolderSelect = (folder: GoogleDriveFolder) => {
    setSelectedFolder(folder);
  };

  const handleConfirm = async () => {
    if (!selectedFolder) return;

    try {
      await setDedicatedFolder(selectedFolder.id, selectedFolder.name);
      onFolderSelected();
    } catch (error) {
      console.error('Error setting dedicated folder:', error);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Escolher Pasta do Google Drive</CardTitle>
        <CardDescription>
          Selecione uma pasta para sincronizar suas fotos
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button 
              onClick={() => fetchFolders(false)} 
              disabled={fetchingFolders}
              variant="outline"
              size="sm"
            >
              {fetchingFolders ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Carregando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Recarregar Pastas
                </>
              )}
            </Button>
            
            <Button 
              onClick={() => fetchFolders(true)} 
              disabled={fetchingFolders}
              variant="outline"
              size="sm"
            >
              Incluir Drives Compartilhados
            </Button>

            <Button 
              onClick={handleDiagnostics} 
              disabled={loading}
              variant="outline"
              size="sm"
            >
              <Wrench className="h-4 w-4 mr-2" />
              Diagnóstico
            </Button>
          </div>

          {fetchingFolders ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Carregando pastas...</span>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-destructive mb-4">{error}</p>
              <div className="space-x-2">
                <Button onClick={() => fetchFolders(false)} variant="outline">
                  Tentar Novamente
                </Button>
                <Button onClick={onClose} variant="ghost">
                  Fechar
                </Button>
              </div>
            </div>
          ) : folders.length > 0 || sharedDrives.length > 0 ? (
            <ScrollArea className="h-80">
              <div className="space-y-2">
                {sharedDrives.length > 0 && (
                  <>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Drives Compartilhados</h4>
                    {sharedDrives.map((drive) => (
                      <div
                        key={`shared-${drive.id}`}
                        className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-accent"
                        onClick={() => setSelectedFolder({ id: drive.id, name: drive.name })}
                      >
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>{drive.name}</span>
                        </div>
                        {selectedFolder?.id === drive.id && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </div>
                    ))}
                    {folders.length > 0 && <div className="border-t my-4" />}
                  </>
                )}
                
                {folders.length > 0 && (
                  <>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Meu Drive</h4>
                    {folders.map((folder) => (
                      <div
                        key={folder.id}
                        className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-accent"
                        onClick={() => handleFolderSelect(folder)}
                      >
                        <div className="flex items-center gap-2">
                          <Folder className="h-4 w-4 text-muted-foreground" />
                          <span>{folder.name}</span>
                        </div>
                        {selectedFolder?.id === folder.id && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </div>
                    ))}
                  </>
                )}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Nenhuma pasta encontrada</p>
            </div>
          )}

          {selectedFolder && (
            <div className="mt-4 p-3 bg-accent rounded-lg">
              <p className="text-sm text-muted-foreground">Pasta selecionada:</p>
              <p className="font-medium">{selectedFolder.name}</p>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-6">
            <Button 
              onClick={handleConfirm}
              disabled={!selectedFolder || loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Confirmando...
                </>
              ) : (
                'Confirmar Pasta'
              )}
            </Button>
            <Button onClick={onClose} variant="ghost">
              Cancelar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}