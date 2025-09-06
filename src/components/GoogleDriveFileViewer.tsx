import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Folder, Image, Video, Download, Upload, X, ArrowLeft } from 'lucide-react';
import { useGoogleDrive, GoogleDriveFile, GoogleDriveFolder } from '@/hooks/useGoogleDrive';
import { useSupabaseData } from '@/hooks/useSupabaseData';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface GoogleDriveFileViewerProps {
  onClose: () => void;
}

export function GoogleDriveFileViewer({ onClose }: GoogleDriveFileViewerProps) {
  const { listFiles, downloadFile, uploadFile } = useGoogleDrive();
  const { uploadPhotos } = useSupabaseData();
  const [files, setFiles] = useState<GoogleDriveFile[]>([]);
  const [folders, setFolders] = useState<GoogleDriveFolder[]>([]);
  const [currentFolder, setCurrentFolder] = useState<GoogleDriveFolder | null>(null);
  const [folderPath, setFolderPath] = useState<GoogleDriveFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);

  const fetchFiles = async (folderId?: string) => {
    try {
      setLoading(true);
      const result = await listFiles(folderId);
      setFiles(result.files);
      setFolders(result.folders);
    } catch (error) {
      console.error('Error fetching files:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const navigateToFolder = (folder: GoogleDriveFolder) => {
    setCurrentFolder(folder);
    setFolderPath([...folderPath, folder]);
    fetchFiles(folder.id);
  };

  const navigateBack = () => {
    if (folderPath.length === 0) return;
    
    const newPath = folderPath.slice(0, -1);
    setFolderPath(newPath);
    
    if (newPath.length === 0) {
      setCurrentFolder(null);
      fetchFiles();
    } else {
      const parentFolder = newPath[newPath.length - 1];
      setCurrentFolder(parentFolder);
      fetchFiles(parentFolder.id);
    }
  };

  const handleImportFile = async (file: GoogleDriveFile) => {
    try {
      setImporting(file.id);
      
      // Download file from Google Drive
      const blob = await downloadFile(file.id);
      
      // Convert blob to File object
      const fileObj = new File([blob], file.name, { type: file.mimeType });
      
      // Upload to PhotoLabel
      await uploadPhotos([fileObj]);
      
    } catch (error) {
      console.error('Error importing file:', error);
    } finally {
      setImporting(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const photoFiles = files.filter(file => file.mediaType === 'photo');
  const videoFiles = files.filter(file => file.mediaType === 'video');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {folderPath.length > 0 && (
              <Button variant="ghost" size="sm" onClick={navigateBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <span>Arquivos do Google Drive</span>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardTitle>
        <CardDescription>
          {folderPath.length === 0 
            ? 'Visualize e importe arquivos da sua pasta dedicada'
            : `Pasta: ${folderPath.map(f => f.name).join(' / ')}`
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Carregando arquivos...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Folders */}
            {folders.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Pastas</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {folders.map((folder) => (
                    <div
                      key={folder.id}
                      className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-accent transition-colors"
                      onClick={() => navigateToFolder(folder)}
                    >
                      <Folder className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium truncate">{folder.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Files */}
            {files.length > 0 ? (
              <Tabs defaultValue="photos" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="photos" className="flex items-center gap-2">
                    <Image className="h-4 w-4" />
                    Fotos ({photoFiles.length})
                  </TabsTrigger>
                  <TabsTrigger value="videos" className="flex items-center gap-2">
                    <Video className="h-4 w-4" />
                    Vídeos ({videoFiles.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="photos" className="mt-4">
                  <ScrollArea className="h-96">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-1">
                      {photoFiles.map((file) => (
                        <div key={file.id} className="relative group">
                          <div className="aspect-square rounded-lg overflow-hidden border bg-muted">
                            {file.thumbnailLink ? (
                              <img
                                src={file.thumbnailLink}
                                alt={file.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Image className="h-8 w-8 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                            <Button
                              size="sm"
                              onClick={() => handleImportFile(file)}
                              disabled={importing === file.id}
                              className="flex items-center gap-1"
                            >
                              {importing === file.id ? (
                                <>
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  Importando...
                                </>
                              ) : (
                                <>
                                  <Download className="h-3 w-3" />
                                  Importar
                                </>
                              )}
                            </Button>
                          </div>

                          <div className="mt-2 space-y-1">
                            <p className="text-xs font-medium truncate">{file.name}</p>
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>{formatFileSize(file.size)}</span>
                              <span>
                                {formatDistanceToNow(new Date(file.modifiedTime), { 
                                  addSuffix: true, 
                                  locale: ptBR 
                                })}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="videos" className="mt-4">
                  <ScrollArea className="h-96">
                    <div className="space-y-3 p-1">
                      {videoFiles.map((file) => (
                        <div key={file.id} className="flex items-center gap-4 p-4 border rounded-lg">
                          <div className="flex-shrink-0">
                            {file.thumbnailLink ? (
                              <img
                                src={file.thumbnailLink}
                                alt={file.name}
                                className="w-16 h-16 object-cover rounded"
                              />
                            ) : (
                              <div className="w-16 h-16 bg-muted rounded flex items-center justify-center">
                                <Video className="h-6 w-6 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{file.name}</p>
                            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                              <span>{formatFileSize(file.size)}</span>
                              <span>
                                {formatDistanceToNow(new Date(file.modifiedTime), { 
                                  addSuffix: true, 
                                  locale: ptBR 
                                })}
                              </span>
                            </div>
                          </div>

                          <Button
                            size="sm"
                            onClick={() => handleImportFile(file)}
                            disabled={importing === file.id}
                            className="flex items-center gap-2"
                          >
                            {importing === file.id ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Importando...
                              </>
                            ) : (
                              <>
                                <Download className="h-4 w-4" />
                                Importar
                              </>
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            ) : (
              !loading && (
                <div className="text-center py-8 text-muted-foreground">
                  <Image className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum arquivo encontrado nesta pasta</p>
                </div>
              )
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}