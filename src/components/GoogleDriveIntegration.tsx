import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Cloud, Folder, Unplug, Settings } from 'lucide-react';
import { useGoogleDrive } from '@/hooks/useGoogleDrive';
import { GoogleDriveFolderSelector } from './GoogleDriveFolderSelector';
import { GoogleDriveFileViewer } from './GoogleDriveFileViewer';

export function GoogleDriveIntegration() {
  const { status, loading, connect, disconnect } = useGoogleDrive();
  const [showFolderSelector, setShowFolderSelector] = useState(false);
  const [showFileViewer, setShowFileViewer] = useState(false);

  const handleConnect = async () => {
    await connect();
  };

  const handleDisconnect = async () => {
    await disconnect();
    setShowFolderSelector(false);
    setShowFileViewer(false);
  };

  const handleFolderSelected = () => {
    setShowFolderSelector(false);
    setShowFileViewer(true);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Integração Google Drive
          </CardTitle>
          <CardDescription>
            Conecte sua conta do Google Drive para backup e sincronização de fotos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex flex-col">
                <span className="text-sm font-medium">Status da Conexão</span>
                <div className="flex items-center gap-2 mt-1">
                  {status.isConnected ? (
                    <>
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        Conectado
                      </Badge>
                      {status.isExpired && (
                        <Badge variant="destructive">Token Expirado</Badge>
                      )}
                    </>
                  ) : (
                    <Badge variant="secondary">Desconectado</Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              {!status.isConnected ? (
                <Button 
                  onClick={handleConnect} 
                  disabled={loading}
                  className="flex items-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Cloud className="h-4 w-4" />
                  )}
                  Conectar Google Drive
                </Button>
              ) : (
                <Button 
                  variant="destructive" 
                  onClick={handleDisconnect} 
                  disabled={loading}
                  className="flex items-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Unplug className="h-4 w-4" />
                  )}
                  Desconectar
                </Button>
              )}
            </div>
          </div>

          {status.isConnected && (
            <div className="space-y-4">
              <div className="border-t pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium">Pasta Dedicada</h4>
                    {status.dedicatedFolder ? (
                      <div className="flex items-center gap-2 mt-1">
                        <Folder className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {status.dedicatedFolder.name}
                        </span>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Nenhuma pasta configurada
                      </p>
                    )}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowFolderSelector(true)}
                    className="flex items-center gap-2"
                  >
                    <Settings className="h-4 w-4" />
                    {status.dedicatedFolder ? 'Alterar Pasta' : 'Escolher Pasta'}
                  </Button>
                </div>
              </div>

              <div className="border-t pt-4">
                {status.dedicatedFolder ? (
                  <Button
                    onClick={() => setShowFileViewer(true)}
                    className="w-full"
                  >
                    Visualizar Arquivos do Drive
                  </Button>
                ) : (
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-3">
                      Para visualizar seus arquivos, primeiro escolha uma pasta dedicada do Google Drive
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => setShowFolderSelector(true)}
                      className="flex items-center gap-2"
                    >
                      <Settings className="h-4 w-4" />
                      Escolher Pasta Dedicada
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {showFolderSelector && (
        <GoogleDriveFolderSelector
          onFolderSelected={handleFolderSelected}
          onClose={() => setShowFolderSelector(false)}
        />
      )}

      {showFileViewer && status.dedicatedFolder && (
        <GoogleDriveFileViewer
          onClose={() => setShowFileViewer(false)}
        />
      )}
    </div>
  );
}