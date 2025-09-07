import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Cloud, Folder, Unplug, Settings, RefreshCw } from 'lucide-react';
import { useGoogleDrive } from '@/hooks/useGoogleDrive';
import GoogleDriveFolderSelector from './GoogleDriveFolderSelector';
import { GoogleDriveFileViewer } from './GoogleDriveFileViewer';
import { useToast } from '@/hooks/use-toast';

export function GoogleDriveIntegration() {
  const { status, loading, connect, disconnect, resetIntegration, runDiagnostics, diagnoseScopes, diagnoseListing, checkTokenInfo } = useGoogleDrive();
  const [showFolderSelector, setShowFolderSelector] = useState(false);
  const [showFileViewer, setShowFileViewer] = useState(false);
  const { toast } = useToast();

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

  const handleReconnectWithPermissions = async () => {
    try {
      // First reset the integration to clear old tokens/scopes
      await resetIntegration();
      // Then connect with fresh OAuth flow
      await connect();
    } catch (error) {
      console.error('Error reconnecting with permissions:', error);
    }
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
              ) : status.isExpired ? (
                <div className="flex gap-2">
                  <Button 
                    onClick={handleConnect} 
                    disabled={loading}
                    className="flex items-center gap-2"
                    variant="default"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Reconectar
                  </Button>
                  <Button 
                    variant="outline" 
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
                </div>
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

          {status.isConnected && status.isExpired && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-3">
                <RefreshCw className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-amber-800">Token Expirado</h4>
                  <p className="text-sm text-amber-700 mt-1">
                    Sua conexão com o Google Drive expirou. Clique em "Reconectar" para renovar 
                    sua conexão e continuar usando a integração.
                  </p>
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
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={runDiagnostics}
                      disabled={loading}
                      className="flex items-center gap-2"
                    >
                      <Settings className="h-4 w-4" />
                      Diagnóstico Completo
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const result = await checkTokenInfo();
                        if (result.success) {
                          const hasRequired = result.data?.hasRequiredScopes;
                          const scopes = result.data?.scopes || [];
                          const expiresIn = result.data?.expires_in;
                          
                          toast({
                            title: hasRequired ? '✅ Escopos Corretos' : '❌ Escopos Insuficientes',
                            description: `${hasRequired ? 'Permissões OK' : 'Faltam permissões'}: ${scopes.join(', ')}${expiresIn ? ` (expira em ${Math.floor(expiresIn/3600)}h)` : ''}`,
                            variant: hasRequired ? 'default' : 'destructive'
                          });
                          
                          console.log('🔍 Scope Sanity Check:', {
                            scopes: scopes,
                            expires_in: expiresIn,
                            hasRequired: hasRequired,
                            required: result.data?.requiredScopes
                          });
                        } else {
                          toast({
                            title: '❌ Erro no Token Info',
                            description: result.error || 'Falha ao verificar escopos',
                            variant: 'destructive'
                          });
                        }
                      }}
                      className="flex items-center gap-2"
                    >
                      <Settings className="h-4 w-4" />
                      Verificar Escopos (TokenInfo)
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const result = await diagnoseScopes();
                        if (result.success) {
                          const hasRequired = result.data?.hasRequiredScopes;
                          const scopes = result.data?.scopes || [];
                          toast({
                            title: hasRequired ? '✅ Escopos OK' : '❌ Escopos Insuficientes',
                            description: `${hasRequired ? 'Permissões corretas' : 'Faltam permissões'}: ${scopes.length} escopos encontrados`,
                            variant: hasRequired ? 'default' : 'destructive'
                          });
                        }
                      }}
                      disabled={loading}
                      className="flex items-center gap-2"
                    >
                      <Settings className="h-4 w-4" />
                      Verificar Escopos
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const result = await diagnoseListing();
                        if (result.success) {
                          const count = result.data?.filesCount || 0;
                          toast({
                            title: count > 0 ? '✅ Pastas Encontradas' : '❌ Nenhuma Pasta',
                            description: `${count} pastas na raiz do Google Drive`,
                            variant: count > 0 ? 'default' : 'destructive'
                          });
                        }
                      }}
                      disabled={loading}
                      className="flex items-center gap-2"
                    >
                      <Folder className="h-4 w-4" />
                      Testar Listagem
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowFolderSelector(true)}
                      className="flex items-center gap-2"
                    >
                      <Folder className="h-4 w-4" />
                      {status.dedicatedFolder ? 'Alterar Pasta' : 'Escolher Pasta'}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between items-center">
                  <div className="flex gap-2">
                    {status.dedicatedFolder ? (
                      <Button
                        onClick={() => setShowFileViewer(true)}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <Folder className="h-4 w-4" />
                        Ver Arquivos
                      </Button>
                    ) : null}
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      onClick={handleConnect}
                      variant="outline"
                      size="sm"
                      disabled={loading}
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