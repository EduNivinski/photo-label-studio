import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Folder, Check, X } from 'lucide-react';
import { useGoogleDrive, GoogleDriveFolder } from '@/hooks/useGoogleDrive';

interface GoogleDriveFolderSelectorProps {
  onFolderSelected: () => void;
  onClose: () => void;
}

export function GoogleDriveFolderSelector({ onFolderSelected, onClose }: GoogleDriveFolderSelectorProps) {
  const { listFolders, setDedicatedFolder, loading } = useGoogleDrive();
  const [folders, setFolders] = useState<GoogleDriveFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<GoogleDriveFolder | null>(null);
  const [fetchingFolders, setFetchingFolders] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFolders = async () => {
      try {
        setFetchingFolders(true);
        setError(null);
        console.log('🚀 Starting to fetch folders...');
        const folderList = await listFolders();
        console.log('📋 Received folders:', folderList);
        setFolders(folderList);
      } catch (error) {
        console.error('❌ Error fetching folders:', error);
        setError(error instanceof Error ? error.message : 'Erro desconhecido');
        setFolders([]);
      } finally {
        setFetchingFolders(false);
      }
    };

    fetchFolders();
  }, [listFolders]);

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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Folder className="h-5 w-5" />
            Escolher Pasta do Google Drive
          </span>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardTitle>
        <CardDescription>
          Selecione uma pasta do seu Google Drive para usar como pasta dedicada do PhotoLabel
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {fetchingFolders ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Carregando pastas...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center space-y-4">
            <div className="text-destructive">
              <p className="font-medium">Erro ao carregar pastas</p>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
            </div>
            <div className="flex gap-2 justify-center">
              <Button 
                onClick={() => {
                  setError(null);
                  setFolders([]);
                  const fetchFolders = async () => {
                    try {
                      setFetchingFolders(true);
                      setError(null);
                      console.log('🔄 Retrying folder fetch...');
                      const folderList = await listFolders();
                      console.log('📋 Retry successful:', folderList);
                      setFolders(folderList);
                    } catch (error) {
                      console.error('❌ Retry failed:', error);
                      setError(error instanceof Error ? error.message : 'Erro desconhecido');
                      setFolders([]);
                    } finally {
                      setFetchingFolders(false);
                    }
                  };
                  fetchFolders();
                }} 
                variant="outline" 
                size="sm"
              >
                Tentar Novamente
              </Button>
              <Button 
                onClick={onClose} 
                variant="ghost" 
                size="sm"
              >
                Fechar
              </Button>
            </div>
          </div>
        ) : (
          <>
            <ScrollArea className="h-64 border rounded-md">
              <div className="p-4 space-y-2">
                {folders.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    Nenhuma pasta encontrada
                  </p>
                ) : (
                  folders.map((folder) => (
                    <div
                      key={folder.id}
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors hover:bg-accent ${
                        selectedFolder?.id === folder.id ? 'bg-accent border-primary' : ''
                      }`}
                      onClick={() => handleFolderSelect(folder)}
                    >
                      <div className="flex items-center gap-2">
                        <Folder className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{folder.name}</span>
                      </div>
                      {selectedFolder?.id === folder.id && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>

            {selectedFolder && (
              <div className="bg-accent/50 p-4 rounded-lg">
                <h4 className="text-sm font-medium mb-2">Pasta Selecionada:</h4>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Folder className="h-4 w-4" />
                  {selectedFolder.name}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleConfirm}
                disabled={!selectedFolder || loading}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Configurando...
                  </>
                ) : (
                  'Confirmar Pasta'
                )}
              </Button>
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}