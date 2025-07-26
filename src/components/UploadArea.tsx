import { useState, useCallback } from 'react';
import { Upload, File, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';

interface UploadAreaProps {
  onUpload: (files: File[]) => Promise<void>;
  isUploading: boolean;
}

export function UploadArea({ onUpload, isUploading }: UploadAreaProps) {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const { toast } = useToast();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = Array.from(e.dataTransfer.files).filter(file => 
      file.type.startsWith('image/') || file.type.startsWith('video/')
    );
    
    if (files.length === 0) {
      toast({
        title: "Arquivos inválidos",
        description: "Apenas imagens e vídeos são permitidos.",
        variant: "destructive"
      });
      return;
    }
    
    setSelectedFiles(files);
  }, [toast]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setSelectedFiles(files);
    }
  }, []);

  const handleUpload = useCallback(async () => {
    if (selectedFiles.length === 0) return;
    
    try {
      await onUpload(selectedFiles);
      setSelectedFiles([]);
      toast({
        title: "Upload concluído",
        description: `${selectedFiles.length} arquivo(s) enviado(s) com sucesso!`
      });
    } catch (error) {
      toast({
        title: "Erro no upload",
        description: "Falha ao enviar os arquivos. Tente novamente.",
        variant: "destructive"
      });
    }
  }, [selectedFiles, onUpload, toast]);

  const removeFile = useCallback((index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  return (
    <div className="space-y-4">
      {/* Drop Area */}
      <div
        className={`
          border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200
          ${dragOver 
            ? 'border-primary bg-photo-hover' 
            : 'border-photo-border hover:border-primary/50'
          }
          ${isUploading ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">
          Arraste arquivos aqui ou clique para selecionar
        </h3>
        <p className="text-sm text-muted-foreground">
          Suporte para imagens e vídeos (PNG, JPG, MP4, etc.)
        </p>
        
        <input
          id="file-input"
          type="file"
          multiple
          accept="image/*,video/*"
          className="hidden"
          onChange={handleFileSelect}
          disabled={isUploading}
        />
      </div>

      {/* File List */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium text-foreground">
            Arquivos selecionados ({selectedFiles.length})
          </h4>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {selectedFiles.map((file, index) => (
              <div key={index} className="flex items-center gap-3 p-2 bg-muted rounded-lg">
                <File className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm truncate flex-1">{file.name}</span>
                <span className="text-xs text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(1)} MB
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => removeFile(index)}
                  disabled={isUploading}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
          
          <div className="flex gap-2">
            <Button
              onClick={handleUpload}
              disabled={isUploading || selectedFiles.length === 0}
              className="flex-1"
            >
              {isUploading ? 'Enviando...' : `Enviar ${selectedFiles.length} arquivo(s)`}
            </Button>
            <Button
              variant="outline"
              onClick={() => setSelectedFiles([])}
              disabled={isUploading}
            >
              Limpar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}