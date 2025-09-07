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
  const { status, loading, connect, disconnect, resetIntegration, runDiagnostics, diagnoseScopes, diagnoseListing, checkTokenInfo, diagScopes, diagListRoot, diagListFolder, diagListSharedDrive, diagPing } = useGoogleDrive();
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
    await resetIntegration();
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

              {/* Seção de Testes de Diagnóstico */}
              <div className="border rounded-lg p-4 bg-muted/30">
                <h4 className="font-medium mb-4 text-lg">🔬 Testes de Diagnóstico Completo</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Execute os testes abaixo em ordem para validar a integração Google Drive:
                </p>
                
                <div className="space-y-3">
                  <Button
                    variant="outline"
                    onClick={async () => {
                      const result = await diagPing();
                      console.log('🏓 DIAG PING JSON:', JSON.stringify(result.data, null, 2));
                      if (result.success) {
                        toast({
                          title: '✅ Teste 0: Ping Edge Functions',
                          description: `Edge Functions OK: ${result.data?.ok ? 'Funcionando' : 'Problema'}`,
                        });
                      } else {
                        toast({
                          title: '❌ Erro no Teste de Ping',
                          description: result.error,
                          variant: 'destructive'
                        });
                      }
                    }}
                    className="w-full justify-start h-auto py-3"
                  >
                    <div className="flex items-center gap-3 w-full">
                      <div className="flex items-center justify-center w-8 h-8 bg-blue-500/10 rounded-full">
                        <span className="text-sm font-medium">0</span>
                      </div>
                      <div className="text-left">
                        <div className="font-medium">diag-ping</div>
                        <div className="text-sm text-muted-foreground">Testar conectividade das Edge Functions</div>
                      </div>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    onClick={async () => {
                      const result = await diagScopes();
                      console.log('🔍 DIAG SCOPES JSON:', JSON.stringify(result.data, null, 2));
                      if (result.success) {
                        toast({
                          title: '✅ Teste 1: Escopos',
                          description: `Status: ${result.data?.status} | Escopos: ${result.data?.hasRequiredScopes ? 'OK' : 'Faltam'}`,
                        });
                      } else {
                        toast({
                          title: '❌ Erro no Teste de Escopos',
                          description: result.error,
                          variant: 'destructive'
                        });
                      }
                    }}
                    className="w-full justify-start h-auto py-3"
                  >
                    <div className="flex items-center gap-3 w-full">
                      <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded-full">
                        <span className="text-sm font-medium">1</span>
                      </div>
                      <div className="text-left">
                        <div className="font-medium">diag-scopes</div>
                        <div className="text-sm text-muted-foreground">Verificar escopos do token OAuth</div>
                      </div>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    onClick={async () => {
                      const result = await diagListRoot();
                      console.log('📋 DIAG LIST ROOT JSON:', JSON.stringify(result.data, null, 2));
                      if (result.success) {
                        toast({
                          title: '✅ Teste 2: Listagem Raiz',
                          description: `Status: ${result.data?.status} | Pastas: ${result.data?.filesCount}`,
                        });
                      } else {
                        toast({
                          title: '❌ Erro no Teste de Listagem',
                          description: result.error,
                          variant: 'destructive'
                        });
                      }
                    }}
                    className="w-full justify-start h-auto py-3"
                  >
                    <div className="flex items-center gap-3 w-full">
                      <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded-full">
                        <span className="text-sm font-medium">2</span>
                      </div>
                      <div className="text-left">
                        <div className="font-medium">diag-list-root</div>
                        <div className="text-sm text-muted-foreground">Testar listagem da raiz do Meu Drive</div>
                      </div>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    onClick={async () => {
                      const folderId = status.dedicatedFolder?.id || 'root';
                      const result = await diagListFolder(folderId);
                      console.log('📁 DIAG LIST FOLDER JSON:', JSON.stringify(result.data, null, 2));
                      if (result.success) {
                        toast({
                          title: '✅ Teste 3: Pasta Dedicada',
                          description: `Status: ${result.data?.status} | Itens: ${result.data?.filesCount}`,
                        });
                      } else {
                        toast({
                          title: '❌ Erro no Teste da Pasta',
                          description: result.error,
                          variant: 'destructive'
                        });
                      }
                    }}
                    className="w-full justify-start h-auto py-3"
                  >
                    <div className="flex items-center gap-3 w-full">
                      <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded-full">
                        <span className="text-sm font-medium">3</span>
                      </div>
                      <div className="text-left">
                        <div className="font-medium">diag-list-folder</div>
                        <div className="text-sm text-muted-foreground">Testar pasta específica ({status.dedicatedFolder?.name || 'root'})</div>
                      </div>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    onClick={async () => {
                      const result = await diagListSharedDrive();
                      console.log('🤝 DIAG LIST SHARED JSON:', JSON.stringify(result.data, null, 2));
                      if (result.success) {
                        toast({
                          title: '✅ Teste 4: Shared Drives',
                          description: `Status: ${result.data?.status} | Drive: ${result.data?.drive?.name || 'N/A'}`,
                        });
                      } else {
                        toast({
                          title: '❌ Erro no Teste Shared Drives',
                          description: result.error,
                          variant: 'destructive'
                        });
                      }
                    }}
                    className="w-full justify-start h-auto py-3"
                  >
                    <div className="flex items-center gap-3 w-full">
                      <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded-full">
                        <span className="text-sm font-medium">4</span>
                      </div>
                      <div className="text-left">
                        <div className="font-medium">diag-list-shared-drive</div>
                        <div className="text-sm text-muted-foreground">Testar Shared Drives (se disponível)</div>
                      </div>
                    </div>
                  </Button>
                </div>
              </div>

              {/* Seção de Gerenciamento */}
              <div className="border rounded-lg p-4">
                <h4 className="font-medium mb-4">🔧 Gerenciamento</h4>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setShowFolderSelector(true)}
                      className="flex items-center gap-2"
                    >
                      <Folder className="h-4 w-4" />
                      {status.dedicatedFolder ? 'Alterar Pasta' : 'Escolher Pasta'}
                    </Button>
                    
                    {status.dedicatedFolder && (
                      <Button
                        onClick={() => setShowFileViewer(true)}
                        variant="outline"
                        className="flex items-center gap-2"
                      >
                        <Folder className="h-4 w-4" />
                        Ver Arquivos
                      </Button>
                    )}
                  </div>
                  
                  <div className="flex gap-2 pt-2 border-t">
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
                    <Button
                      onClick={handleDisconnect}
                      variant="destructive"
                      size="sm"
                      disabled={loading}
                      className="flex items-center gap-2"
                    >
                      <Unplug className="h-4 w-4" />
                      Desconectar
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