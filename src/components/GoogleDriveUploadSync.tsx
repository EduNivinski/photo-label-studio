import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Cloud, CloudUpload, Settings } from 'lucide-react';
import { useGoogleDrive } from '@/hooks/useGoogleDrive';
import { useToast } from '@/hooks/use-toast';

interface GoogleDriveUploadSyncProps {
  files: File[];
  onFilesUploaded?: (files: File[]) => void;
}

export function GoogleDriveUploadSync({ files, onFilesUploaded }: GoogleDriveUploadSyncProps) {
  const { status, loading, uploadFile } = useGoogleDrive();
  const { toast } = useToast();
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleSyncToggle = (enabled: boolean) => {
    if (!status.isConnected) {
      toast({
        title: "Google Drive não conectado",
        description: "Conecte seu Google Drive primeiro para ativar a sincronização.",
        variant: "destructive",
      });
      return;
    }

    if (!status.dedicatedFolder) {
      toast({
        title: "Pasta não configurada",
        description: "Configure uma pasta dedicada antes de ativar a sincronização.",
        variant: "destructive",
      });
      return;
    }

    setSyncEnabled(enabled);
  };

  const handleUploadToGoogleDrive = async () => {
    if (!status.isConnected || !status.dedicatedFolder || files.length === 0) return;

    try {
      setUploading(true);
      let successCount = 0;

      for (const file of files) {
        try {
          await uploadFile(file);
          successCount++;
        } catch (error) {
          console.error(`Failed to upload ${file.name}:`, error);
        }
      }

      if (successCount > 0) {
        toast({
          title: "Upload concluído",
          description: `${successCount} arquivo${successCount !== 1 ? 's' : ''} enviado${successCount !== 1 ? 's' : ''} para o Google Drive.`,
        });
        
        onFilesUploaded?.(files);
      }
    } catch (error) {
      console.error('Error uploading files to Google Drive:', error);
    } finally {
      setUploading(false);
    }
  };

  if (!status.isConnected) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="text-center space-y-2">
            <Cloud className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Conecte seu Google Drive para sincronizar uploads
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <CloudUpload className="h-5 w-5" />
              Sincronização Google Drive
            </CardTitle>
            <CardDescription className="text-sm mt-1">
              {status.dedicatedFolder 
                ? `Pasta: ${status.dedicatedFolder.name}`
                : "Configure uma pasta dedicada"
              }
            </CardDescription>
          </div>
          <Badge variant={status.isConnected ? "default" : "secondary"} className="text-xs">
            {status.isConnected ? "Conectado" : "Desconectado"}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Sincronização Automática</p>
            <p className="text-xs text-muted-foreground">
              Enviar automaticamente uploads para o Google Drive
            </p>
          </div>
          <Switch
            checked={syncEnabled}
            onCheckedChange={handleSyncToggle}
            disabled={loading || !status.dedicatedFolder}
          />
        </div>

        {files.length > 0 && status.dedicatedFolder && (
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center justify-between text-sm">
              <span>{files.length} arquivo{files.length !== 1 ? 's' : ''} para sincronizar</span>
              <Button
                size="sm"
                onClick={handleUploadToGoogleDrive}
                disabled={uploading || loading}
                className="gap-2"
              >
                {uploading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <CloudUpload className="h-4 w-4" />
                    Enviar para Drive
                  </>
                )}
              </Button>
            </div>
            
            {syncEnabled && (
              <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                ℹ️ Os arquivos serão enviados automaticamente após o upload para o Photo Label
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}