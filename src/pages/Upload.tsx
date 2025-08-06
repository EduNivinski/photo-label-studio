import { useState, useCallback } from 'react';
import { Upload as UploadIcon, FileText, Image, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useSupabaseData } from '@/hooks/useSupabaseData';
import { useToast } from '@/hooks/use-toast';
import { UploadLabelSelectorInline } from '@/components/UploadLabelSelectorInline';

interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  selectedLabels: string[];
}

export default function Upload() {
  const { labels, uploadPhotos } = useSupabaseData();
  const { toast } = useToast();
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      handleFiles(files);
    }
  };

  const handleFiles = (files: File[]) => {
    const newUploadingFiles: UploadingFile[] = files.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      progress: 0,
      status: 'pending',
      selectedLabels: []
    }));

    setUploadingFiles(prev => [...prev, ...newUploadingFiles]);
  };

  const handleStartUpload = async () => {
    const pendingFiles = uploadingFiles.filter(uf => uf.status === 'pending');
    if (pendingFiles.length === 0) return;

    // Update status to uploading
    setUploadingFiles(prev => prev.map(uf => 
      uf.status === 'pending' ? { ...uf, status: 'uploading' as const } : uf
    ));

    for (const uploadingFile of pendingFiles) {
      try {
        // Simulate progress
        const progressInterval = setInterval(() => {
          setUploadingFiles(prev => prev.map(uf => 
            uf.id === uploadingFile.id 
              ? { ...uf, progress: Math.min(uf.progress + 20, 90) }
              : uf
          ));
        }, 200);

        const uploadedPhotos = await uploadPhotos([uploadingFile.file]);
        
        clearInterval(progressInterval);

        if (uploadedPhotos && uploadedPhotos.length > 0) {
          // Apply labels if selected
          if (uploadingFile.selectedLabels.length > 0) {
            // TODO: Apply labels to uploaded photo
          }

          setUploadingFiles(prev => prev.map(uf => 
            uf.id === uploadingFile.id 
              ? { ...uf, progress: 100, status: 'completed' as const }
              : uf
          ));

          toast({
            title: "Upload concluído!",
            description: `${uploadingFile.file.name} foi enviado com sucesso.`,
          });
        } else {
          throw new Error('Upload failed');
        }
      } catch (error) {
        setUploadingFiles(prev => prev.map(uf => 
          uf.id === uploadingFile.id 
            ? { ...uf, status: 'error' as const }
            : uf
        ));

        toast({
          title: "Erro no upload",
          description: `Falha ao enviar ${uploadingFile.file.name}.`,
          variant: "destructive",
        });
      }
    }
  };

  const handleLabelChange = (fileId: string, labelIds: string[]) => {
    setUploadingFiles(prev => prev.map(uf => 
      uf.id === fileId ? { ...uf, selectedLabels: labelIds } : uf
    ));
  };

  const removeFile = (fileId: string) => {
    setUploadingFiles(prev => prev.filter(uf => uf.id !== fileId));
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <Image className="h-6 w-6" />;
    if (file.type.startsWith('video/')) return <Video className="h-6 w-6" />;
    return <FileText className="h-6 w-6" />;
  };

  const getFileTypeColor = (file: File) => {
    if (file.type.startsWith('image/')) return 'bg-blue-500/10 text-blue-600';
    if (file.type.startsWith('video/')) return 'bg-purple-500/10 text-purple-600';
    return 'bg-gray-500/10 text-gray-600';
  };

  return (
    <div className="flex-1 min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="px-6 py-4">
          <div className="flex items-center gap-3">
            <UploadIcon className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Upload de Fotos</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Adicione suas fotos e vídeos à biblioteca
          </p>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Upload Area */}
        <Card 
          className={`relative p-12 border-2 border-dashed transition-all duration-200 ${
            isDragOver 
              ? 'border-primary bg-primary/5' 
              : 'border-border hover:border-primary/50'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <div className="text-center">
            <div className="text-8xl mb-6 opacity-60">📤</div>
            <h3 className="text-xl font-semibold text-foreground mb-3">
              Arraste arquivos aqui
            </h3>
            <p className="text-muted-foreground mb-6 text-base">
              Ou clique no botão abaixo para selecionar arquivos
            </p>
            
            <div className="flex justify-center gap-4">
              <Button size="lg" className="gap-2" onClick={() => document.getElementById('file-input')?.click()}>
                <UploadIcon className="h-5 w-5" />
                Selecionar Arquivos
              </Button>
              
              <input
                id="file-input"
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={handleFileInput}
                className="hidden"
              />
            </div>
            
            <p className="text-xs text-muted-foreground mt-4">
              Suporte para imagens (JPEG, PNG, RAW) e vídeos (MP4, MOV, AVI)
            </p>
          </div>
        </Card>

        {/* Upload Queue */}
        {uploadingFiles.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">
                Arquivos para Upload ({uploadingFiles.length})
              </h3>
              
              <Button 
                onClick={handleStartUpload}
                disabled={uploadingFiles.filter(uf => uf.status === 'pending').length === 0}
                className="gap-2"
              >
                <UploadIcon className="h-4 w-4" />
                Iniciar Upload
              </Button>
            </div>

            <div className="space-y-3">
              {uploadingFiles.map((uploadingFile) => (
                <Card key={uploadingFile.id} className="p-4">
                  <div className="flex items-center gap-4">
                    {/* File Icon */}
                    <div className={`p-2 rounded-lg ${getFileTypeColor(uploadingFile.file)}`}>
                      {getFileIcon(uploadingFile.file)}
                    </div>

                    {/* File Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-foreground truncate">
                          {uploadingFile.file.name}
                        </p>
                        <Badge 
                          variant={
                            uploadingFile.status === 'completed' ? 'default' :
                            uploadingFile.status === 'error' ? 'destructive' :
                            uploadingFile.status === 'uploading' ? 'secondary' : 'outline'
                          }
                        >
                          {uploadingFile.status === 'pending' && 'Pendente'}
                          {uploadingFile.status === 'uploading' && 'Enviando...'}
                          {uploadingFile.status === 'completed' && 'Concluído'}
                          {uploadingFile.status === 'error' && 'Erro'}
                        </Badge>
                      </div>
                      
                      <p className="text-sm text-muted-foreground">
                        {(uploadingFile.file.size / 1024 / 1024).toFixed(2)} MB
                      </p>

                      {/* Progress Bar */}
                      {uploadingFile.status === 'uploading' && (
                        <Progress value={uploadingFile.progress} className="mt-2" />
                      )}

                      {/* Label Selector */}
                      {uploadingFile.status === 'pending' && (
                        <div className="mt-3">
                          <UploadLabelSelectorInline
                            labels={labels}
                            selectedLabels={uploadingFile.selectedLabels}
                            onLabelsChange={(labelIds) => handleLabelChange(uploadingFile.id, labelIds)}
                          />
                        </div>
                      )}
                    </div>

                    {/* Remove Button */}
                    {uploadingFile.status !== 'uploading' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(uploadingFile.id)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        ✕
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}