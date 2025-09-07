import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, File, Image, Video, X, Folder, Download } from 'lucide-react';
import { useGoogleDrive, GoogleDriveFile, GoogleDriveFolder } from '@/hooks/useGoogleDrive';
import { useSupabaseData } from '@/hooks/useSupabaseData';
import { useToast } from '@/hooks/use-toast';

interface GoogleDriveFileViewerProps {
  onClose: () => void;
}

export function GoogleDriveFileViewer({ onClose }: GoogleDriveFileViewerProps) {
  const { listFiles, loading, importFileToPhotoLabel } = useGoogleDrive();
  const { uploadPhotos } = useSupabaseData();
  const { toast } = useToast();
  const [files, setFiles] = useState<GoogleDriveFile[]>([]);
  const [folders, setFolders] = useState<GoogleDriveFolder[]>([]);
  const [fetchingFiles, setFetchingFiles] = useState(false);
  const [importingFiles, setImportingFiles] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        setFetchingFiles(true);
        const filesData = await listFiles();
        setFiles(filesData);
        // Note: listFiles now returns only files, folders are handled separately
        setFolders([]); // You may need to implement listFolders for this component
      } catch (error) {
        console.error('Error fetching files:', error);
      } finally {
        setFetchingFiles(false);
      }
    };

    fetchFiles();
  }, [listFiles]);

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <Image className="h-4 w-4 text-blue-500" />;
    if (mimeType.startsWith('video/')) return <Video className="h-4 w-4 text-purple-500" />;
    return <File className="h-4 w-4 text-gray-500" />;
  };

  const handleImportFile = async (file: GoogleDriveFile) => {
    try {
      setImportingFiles(prev => new Set(prev.add(file.id)));
      
      // Import file from Google Drive
      const importedFile = await importFileToPhotoLabel(file.id, file.name);
      
      // Upload to Photo Label
      const uploadedPhotos = await uploadPhotos([importedFile]);
      
      if (uploadedPhotos && uploadedPhotos.length > 0) {
        toast({
          title: "Importação concluída!",
          description: `${file.name} foi importado com sucesso para o Photo Label.`,
        });
      } else {
        throw new Error('Failed to upload imported file');
      }
    } catch (error) {
      console.error('Error importing file:', error);
      toast({
        title: "Erro na importação",
        description: `Falha ao importar ${file.name}.`,
        variant: "destructive",
      });
    } finally {
      setImportingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(file.id);
        return newSet;
      });
    }
  };

  const handleImportAll = async () => {
    if (files.length === 0) return;
    
    const mediaFiles = files.filter(f => 
      f.mimeType.startsWith('image/') || f.mimeType.startsWith('video/')
    );
    
    if (mediaFiles.length === 0) {
      toast({
        title: "Nenhum arquivo de mídia",
        description: "Não há imagens ou vídeos para importar.",
        variant: "destructive",
      });
      return;
    }

    let successCount = 0;
    
    for (const file of mediaFiles) {
      try {
        setImportingFiles(prev => new Set(prev.add(file.id)));
        
        const importedFile = await importFileToPhotoLabel(file.id, file.name);
        const uploadedPhotos = await uploadPhotos([importedFile]);
        
        if (uploadedPhotos && uploadedPhotos.length > 0) {
          successCount++;
        }
      } catch (error) {
        console.error(`Error importing ${file.name}:`, error);
      } finally {
        setImportingFiles(prev => {
          const newSet = new Set(prev);
          newSet.delete(file.id);
          return newSet;
        });
      }
    }
    
    toast({
      title: "Importação em lote concluída",
      description: `${successCount} de ${mediaFiles.length} arquivos foram importados.`,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Folder className="h-5 w-5" />
            Arquivos do Google Drive
          </span>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardTitle>
        <CardDescription>
          Visualize e importe arquivos da sua pasta dedicada para o Photo Label
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {files.filter(f => f.mimeType.startsWith('image/') || f.mimeType.startsWith('video/')).length > 0 && (
          <div className="flex justify-end">
            <Button 
              onClick={handleImportAll}
              disabled={importingFiles.size > 0}
              size="sm"
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Importar Todas as Mídias
            </Button>
          </div>
        )}
        
        {fetchingFiles ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Carregando arquivos...</span>
          </div>
        ) : (
          <ScrollArea className="h-96">
            <div className="space-y-2">
              {folders.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Pastas</h4>
                  {folders.map((folder) => (
                    <div
                      key={folder.id}
                      className="flex items-center gap-2 p-2 rounded-lg border hover:bg-accent"
                    >
                      <Folder className="h-4 w-4 text-blue-500" />
                      <span className="text-sm">{folder.name}</span>
                    </div>
                  ))}
                </div>
              )}

              {files.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Arquivos</h4>
                  {files.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent"
                    >
                      <div className="flex items-center gap-2 flex-1">
                        {getFileIcon(file.mimeType)}
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium truncate block">{file.name}</span>
                          <p className="text-xs text-muted-foreground">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      
                      {/* Só mostrar botão de importar para imagens e vídeos */}
                      {(file.mimeType.startsWith('image/') || file.mimeType.startsWith('video/')) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleImportFile(file)}
                          disabled={importingFiles.has(file.id)}
                          className="flex items-center gap-1 ml-2 shrink-0"
                        >
                          {importingFiles.has(file.id) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                          {importingFiles.has(file.id) ? 'Importando...' : 'Importar'}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {files.length === 0 && folders.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-2">
                    Nenhum arquivo ou pasta encontrada na pasta dedicada
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Certifique-se de que há arquivos na pasta selecionada ou escolha uma pasta diferente
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}