import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, FolderOpen, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface GoogleDriveFolder {
  id: string;
  name: string;
  parents?: string[];
}

interface GoogleDriveTokens {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
}

export function SimpleGoogleDriveAuth() {
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [folders, setFolders] = useState<GoogleDriveFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<GoogleDriveFolder | null>(null);
  const [loadingFolders, setLoadingFolders] = useState(false);

  // Configuração OAuth2
  const CLIENT_ID = '284727625897-h3ol7nqrh3nj6cps49r8o1m47g6qsqq8.apps.googleusercontent.com';
  const REDIRECT_URI = window.location.origin + '/google-drive';
  const SCOPES = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive.readonly'
  ].join(' ');

  useEffect(() => {
    checkExistingConnection();
    handleOAuthCallback();
  }, []);

  const checkExistingConnection = () => {
    const tokens = localStorage.getItem('google_drive_tokens');
    if (tokens) {
      try {
        const parsedTokens: GoogleDriveTokens = JSON.parse(tokens);
        if (parsedTokens.expires_at > Date.now()) {
          setIsConnected(true);
          loadFolders(parsedTokens.access_token);
        } else {
          localStorage.removeItem('google_drive_tokens');
        }
      } catch (error) {
        console.error('Error parsing stored tokens:', error);
        localStorage.removeItem('google_drive_tokens');
      }
    }
  };

  const handleOAuthCallback = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code) {
      exchangeCodeForTokens(code);
      // Limpar URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  const exchangeCodeForTokens = async (code: string) => {
    setLoading(true);
    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: '/* CLIENT_SECRET seria necessário aqui */',
          code,
          grant_type: 'authorization_code',
          redirect_uri: REDIRECT_URI,
        }),
      });

      if (response.ok) {
        const tokens = await response.json();
        const tokenData: GoogleDriveTokens = {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: Date.now() + (tokens.expires_in * 1000),
        };

        localStorage.setItem('google_drive_tokens', JSON.stringify(tokenData));
        setIsConnected(true);
        loadFolders(tokens.access_token);
        toast.success('Google Drive conectado com sucesso!');
      } else {
        throw new Error('Failed to exchange code for tokens');
      }
    } catch (error) {
      console.error('Error exchanging code:', error);
      toast.error('Erro ao conectar com Google Drive');
    } finally {
      setLoading(false);
    }
  };

  const initiateOAuth = () => {
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.append('client_id', CLIENT_ID);
    authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', SCOPES);
    authUrl.searchParams.append('access_type', 'offline');
    authUrl.searchParams.append('prompt', 'consent');

    window.location.href = authUrl.toString();
  };

  const loadFolders = async (accessToken: string) => {
    setLoadingFolders(true);
    try {
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.folder' and parents in 'root'&fields=files(id,name,parents)&pageSize=50`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setFolders(data.files || []);
        console.log(`✅ Encontradas ${data.files?.length || 0} pastas`);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('Error loading folders:', error);
      toast.error('Erro ao carregar pastas do Google Drive');
    } finally {
      setLoadingFolders(false);
    }
  };

  const disconnect = () => {
    localStorage.removeItem('google_drive_tokens');
    setIsConnected(false);
    setFolders([]);
    setSelectedFolder(null);
    toast.success('Google Drive desconectado');
  };

  const refreshFolders = () => {
    const tokens = localStorage.getItem('google_drive_tokens');
    if (tokens) {
      const parsedTokens: GoogleDriveTokens = JSON.parse(tokens);
      loadFolders(parsedTokens.access_token);
    }
  };

  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Google Drive - Integração Simplificada
          </CardTitle>
          <CardDescription>
            Conecte sua conta Google Drive para backup e importação de fotos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium mb-2">⚠️ Implementação Direta</h4>
            <p className="text-sm text-muted-foreground">
              Esta é uma implementação simplificada que armazena tokens localmente.
              Para produção, seria necessário implementar o servidor OAuth2 completo.
            </p>
          </div>
          
          <Button 
            onClick={initiateOAuth} 
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Conectando...
              </>
            ) : (
              <>
                <FolderOpen className="mr-2 h-4 w-4" />
                Conectar Google Drive
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Google Drive Conectado
            </div>
            <Badge variant="secondary">Ativo</Badge>
          </CardTitle>
          <CardDescription>
            Sua conta está conectada e pronta para uso
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={refreshFolders}
              disabled={loadingFolders}
            >
              {loadingFolders ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Atualizar Pastas
            </Button>
            <Button variant="destructive" onClick={disconnect}>
              Desconectar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Selecionar Pasta para Backup</CardTitle>
          <CardDescription>
            Escolha uma pasta do Google Drive para sincronizar suas fotos
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingFolders ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Carregando pastas...
            </div>
          ) : folders.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground mb-4">
                Encontradas {folders.length} pastas na raiz do Google Drive:
              </p>
              <div className="grid gap-2 max-h-64 overflow-y-auto">
                {folders.map((folder) => (
                  <Button
                    key={folder.id}
                    variant={selectedFolder?.id === folder.id ? "default" : "outline"}
                    className="justify-start"
                    onClick={() => setSelectedFolder(folder)}
                  >
                    <FolderOpen className="mr-2 h-4 w-4" />
                    {folder.name}
                  </Button>
                ))}
              </div>
              
              {selectedFolder && (
                <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium">Pasta Selecionada:</h4>
                  <p className="text-sm text-muted-foreground">
                    📁 {selectedFolder.name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    ID: {selectedFolder.id}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Nenhuma pasta encontrada na raiz do Google Drive
              </p>
              <Button 
                variant="outline" 
                onClick={refreshFolders}
                className="mt-4"
              >
                Tentar Novamente
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}