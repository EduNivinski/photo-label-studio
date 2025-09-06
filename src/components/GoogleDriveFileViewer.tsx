import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, File, Image, Video, X, Folder } from 'lucide-react';
import { useGoogleDrive, GoogleDriveFile, GoogleDriveFolder } from '@/hooks/useGoogleDrive';

interface GoogleDriveFileViewerProps {
  onClose: () => void;
}

export function GoogleDriveFileViewer({ onClose }: GoogleDriveFileViewerProps) {
  const { listFiles, loading } = useGoogleDrive();
  const [files, setFiles] = useState<GoogleDriveFile[]>([]);
  const [folders, setFolders] = useState<GoogleDriveFolder[]>([]);
  const [fetchingFiles, setFetchingFiles] = useState(false);

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        setFetchingFiles(true);
        const result = await listFiles();
        setFiles(result.files);
        setFolders(result.folders);
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
          Visualize e gerencie os arquivos na sua pasta dedicada
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
                      className="flex items-center gap-2 p-2 rounded-lg border hover:bg-accent"
                    >
                      {getFileIcon(file.mimeType)}
                      <div className="flex-1">
                        <span className="text-sm font-medium">{file.name}</span>
                        <p className="text-xs text-muted-foreground">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {files.length === 0 && folders.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum arquivo ou pasta encontrada
                </p>
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}