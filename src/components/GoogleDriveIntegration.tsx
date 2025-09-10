import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Cloud, Folder, Unplug, Settings, RefreshCw, FileImage } from 'lucide-react';
import { useGoogleDriveSimple } from '@/hooks/useGoogleDriveSimple';
// import GoogleDriveFolderSelector from './GoogleDriveFolderSelector';
// import { GoogleDriveFileViewer } from './GoogleDriveFileViewer';
import { useToast } from '@/hooks/use-toast';

export function GoogleDriveIntegration() {
  const { status, loading, connect, disconnect, checkStatus } = useGoogleDriveSimple();
  const [showFolderSelector, setShowFolderSelector] = useState(false);
  const [showFileViewer, setShowFileViewer] = useState(false);
  const { toast } = useToast();

  const handleConnect = async () => {
    await connect();
  };

  const handleDisconnect = async () => {
    await disconnect();
  };

  const handleReconnectWithPermissions = async () => {
    await disconnect();
    setTimeout(() => {
      handleConnect();
    }, 1000);
  };

  const handleFolderSelected = () => {
    setShowFolderSelector(false);
    toast({
      title: 'Pasta selecionada',
      description: 'Pasta configurada com sucesso',
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-6 w-6" />
            Integração Google Drive
            {/* Status indicator icon */}
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : status.isConnected ? (
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-green-600 font-medium">Conectado</span>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 bg-gray-400 rounded-full"></div>
                <span className="text-xs text-muted-foreground font-medium">Desconectado</span>
              </div>
            )}
          </CardTitle>
          <CardDescription>
            Conecte e sincronize suas fotos com o Google Drive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!status.isConnected && (
            <div className="space-y-4">
              <div className="text-center py-8">
                <Cloud className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Conectar ao Google Drive</h3>
                <p className="text-muted-foreground mb-6">
                  Conecte sua conta do Google Drive para fazer backup e importar suas fotos
                </p>
                <div className="flex items-center justify-center gap-3">
                  <Button 
                    onClick={handleConnect}
                    disabled={loading}
                    size="lg"
                    className="flex items-center gap-2"
                  >
                    {loading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Cloud className="h-5 w-5" />
                    )}
                    Conectar Google Drive
                  </Button>
                  <Button
                    onClick={() => checkStatus(true)}
                    variant="outline"
                    size="lg"
                    disabled={loading}
                    className="flex items-center gap-2"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Verificar Status
                  </Button>
                </div>
              </div>
            </div>
          )}

          {status.isExpired && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-3">
                <Settings className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-yellow-800">Token Expirado</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    Sua conexão com o Google Drive expirou. Reconecte para continuar usando a integração.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      onClick={handleConnect}
                      disabled={loading}
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Reconectar
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {status.isConnected && !status.dedicatedFolder && !status.isExpired && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-3">
                <Settings className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-blue-800">Novas Permissões Necessárias</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    Para acessar suas pastas do Google Drive, você precisa reconectar 
                    com as novas permissões de leitura de metadados.
                  </p>
                  <div className="mt-3">
                    <Button
                      onClick={handleReconnectWithPermissions}
                      disabled={loading}
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      Reconectar com Permissões
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {status.isConnected && !status.isExpired && (
            <div className="space-y-6">
              {/* Status Badge */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-green-500/20 text-green-700 border-green-500/30">
                    ✅ Conectado
                  </Badge>
                  {status.dedicatedFolder && (
                    <Badge variant="outline" className="text-xs">
                      📁 {status.dedicatedFolder.name}
                    </Badge>
                  )}
                </div>
                
                {/* Manual Status Check Button */}
                <Button
                  onClick={() => checkStatus(true)}
                  variant="outline"
                  size="sm"
                  disabled={loading}
                  className="flex items-center gap-1 text-xs"
                >
                  {loading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                  Verificar Status
                </Button>
              </div>

              {/* Management Section - Always show when connected */}
              <div className="border rounded-lg p-4">
                <h4 className="font-medium mb-4">🔧 Gerenciamento</h4>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        toast({
                          title: 'Funcionalidade temporariamente desabilitada',
                          description: 'Seleção de pasta será reativada em breve',
                        });
                      }}
                      className="flex items-center gap-2"
                    >
                      <Folder className="h-4 w-4" />
                      {status.dedicatedFolder ? 'Alterar Pasta' : 'Escolher Pasta'}
                    </Button>
                    
                    {status.dedicatedFolder && (
                      <Button
                        onClick={() => {
                          toast({
                            title: 'Funcionalidade temporariamente desabilitada',
                            description: 'Visualização de arquivos será reativada em breve',
                          });
                        }}
                        variant="outline"
                        className="flex items-center gap-2"
                      >
                        <FileImage className="h-4 w-4" />
                        Ver Arquivos
                      </Button>
                    )}
                    
                    <Button
                      variant="outline"
                      onClick={handleDisconnect}
                      className="flex items-center gap-2"
                    >
                      <Unplug className="h-4 w-4" />
                      Desconectar
                    </Button>
                    
                    <Button
                      variant="outline"
                      onClick={handleReconnectWithPermissions}
                      disabled={loading}
                      className="flex items-center gap-2"
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      Reconectar
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Temporarily disabled to fix loop issues 
      {showFolderSelector && (
        <GoogleDriveFolderSelector
          onFolderSelected={handleFolderSelected}
          onClose={() => setShowFolderSelector(false)}
        />
      )}
      
      {showFileViewer && (
        <GoogleDriveFileViewer
          onClose={() => setShowFileViewer(false)}
        />
      )}
      */}
    </div>
  );
}