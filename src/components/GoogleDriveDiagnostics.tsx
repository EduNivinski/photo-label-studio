import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, CheckCircle, Loader2, Play, Copy, ExternalLink, Globe } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DiagnosticResult {
  name: string;
  status: 'pending' | 'running' | 'success' | 'error';
  data?: any;
  error?: string;
  rawResponse?: any;
}

interface ConnectivityResult {
  name: string;
  url: string;
  status: 'pending' | 'running' | 'success' | 'error';
  httpStatus?: number;
  accessible: boolean;
}

export function GoogleDriveDiagnostics() {
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const [testingConnectivity, setTestingConnectivity] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  
  const PROJECT_REF = "tcupxcxyylxfgsbhfdhw";
  const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjdXB4Y3h5eWx4ZmdzYmhmZGh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM2NzI0NDMsImV4cCI6MjA2OTI0ODQ0M30.MQM0c-6_buQyKaWFvEtItwmh-vpZgvjgbb3ru8hau40";

  const [connectivityResults, setConnectivityResults] = useState<ConnectivityResult[]>([
    { name: 'diag-scopes', url: `https://${PROJECT_REF}.functions.supabase.co/diag-scopes`, status: 'pending', accessible: false },
    { name: 'diag-list-root', url: `https://${PROJECT_REF}.functions.supabase.co/diag-list-root`, status: 'pending', accessible: false },
    { name: 'diag-list-folder', url: `https://${PROJECT_REF}.functions.supabase.co/diag-list-folder`, status: 'pending', accessible: false }
  ]);

  const [results, setResults] = useState<DiagnosticResult[]>([
    { name: 'diag-scopes', status: 'pending' },
    { name: 'diag-list-root', status: 'pending' },
    { name: 'diag-list-folder', status: 'pending' }
  ]);

  const testConnectivity = async () => {
    setTestingConnectivity(true);
    
    try {
      // Get current user ID first
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('No authenticated user found');
      }
      
      const USER_ID = user.id;
      setCurrentUserId(USER_ID);
      console.log('USER_ID for connectivity test:', USER_ID);

      // Test connectivity to all function endpoints
      const connectivityTests = connectivityResults.map(async (connResult) => {
        try {
          setConnectivityResults(prev => prev.map(r => 
            r.name === connResult.name 
              ? { ...r, status: 'running' }
              : r
          ));

          const testUrl = connResult.name === 'diag-scopes' 
            ? `${connResult.url}?user_id=${USER_ID}`
            : connResult.url;

          console.log(`Testing connectivity to: ${testUrl}`);
          
          const response = await fetch(testUrl, {
            method: connResult.name === 'diag-scopes' ? 'GET' : 'POST',
            headers: {
              'Authorization': `Bearer ${ANON_KEY}`,
              'Content-Type': 'application/json'
            },
            body: connResult.name !== 'diag-scopes' 
              ? JSON.stringify({ user_id: USER_ID })
              : undefined
          });

          const accessible = response.status >= 200 && response.status < 500;
          
          setConnectivityResults(prev => prev.map(r => 
            r.name === connResult.name 
              ? { ...r, status: accessible ? 'success' : 'error', httpStatus: response.status, accessible }
              : r
          ));

          console.log(`${connResult.name}: ${response.status} - ${accessible ? 'Accessible' : 'Not accessible'}`);
        } catch (error) {
          console.error(`Connectivity test failed for ${connResult.name}:`, error);
          setConnectivityResults(prev => prev.map(r => 
            r.name === connResult.name 
              ? { ...r, status: 'error', accessible: false }
              : r
          ));
        }
      });

      await Promise.all(connectivityTests);
      
      toast({
        title: "Teste de conectividade concluído",
        description: "Verifique quais funções estão acessíveis antes de executar os diagnósticos.",
      });

    } catch (error) {
      console.error('Connectivity test error:', error);
      toast({
        title: "Erro no teste de conectividade",
        description: error.message || "Erro ao testar conectividade.",
        variant: "destructive"
      });
    } finally {
      setTestingConnectivity(false);
    }
  };

  const runDiagnostics = async () => {
    setRunning(true);
    
    try {
      // Get current user ID
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('No authenticated user found');
      }

      const USER_ID = user.id;
      setCurrentUserId(USER_ID);
      console.log('USER_ID', USER_ID);

      // Update all to running
      setResults(prev => prev.map(r => ({ ...r, status: 'running' as const })));

      // Run diagnostics using both SDK and fetch as fallback
      const runSingleDiagnostic = async (name: string, body: any) => {
        let result;
        let usedMethod = 'SDK';
        
        try {
          // Try SDK first
          console.log(`Tentando ${name} via SDK...`);
          result = await supabase.functions.invoke(name, {
            method: "POST",
            body: body,
          });
          console.log(`${name.toUpperCase()} (SDK) →`, result);
        } catch (sdkError) {
          console.warn(`SDK falhou para ${name}, tentando fetch direto:`, sdkError);
          usedMethod = 'Fetch';
          
          // Fallback to direct fetch
          const response = await fetch(`https://${PROJECT_REF}.functions.supabase.co/${name}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${ANON_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
          });
          
          const responseData = await response.json().catch(() => ({ raw: 'non-JSON response' }));
          result = {
            data: responseData,
            error: response.ok ? null : responseData,
            status: response.status
          };
          console.log(`${name.toUpperCase()} (Fetch) →`, result);
        }
        
        return { result, usedMethod };
      };

      // Run all diagnostics
      const diagnostics = [
        { name: 'diag-scopes', body: { user_id: USER_ID } },
        { name: 'diag-list-root', body: { user_id: USER_ID } },
        { name: 'diag-list-folder', body: { user_id: USER_ID, folderId: "root", folder_id: "root" } }
      ];

      // Run diagnostics sequentially
      for (const diagnostic of diagnostics) {
        try {
          const { result, usedMethod } = await runSingleDiagnostic(diagnostic.name, diagnostic.body);
          
          setResults(prev => prev.map(r => 
            r.name === diagnostic.name 
              ? { 
                  ...r, 
                  status: 'success', 
                  data: result.data || result, 
                  rawResponse: result,
                  error: `Método: ${usedMethod}${result.error ? ` | Erro: ${JSON.stringify(result.error)}` : ''}`
                }
              : r
          ));
        } catch (error) {
          console.error(`Error in ${diagnostic.name}:`, error);
          setResults(prev => prev.map(r => 
            r.name === diagnostic.name 
              ? { ...r, status: 'error', error: error.message || String(error) }
              : r
          ));
        }
      }

      toast({
        title: "Diagnósticos concluídos",
        description: "Todos os testes foram executados. Verifique os resultados abaixo.",
      });

    } catch (error) {
      console.error('Error running diagnostics:', error);
      toast({
        title: "Erro nos diagnósticos",
        description: error.message || "Erro desconhecido ao executar os testes.",
        variant: "destructive"
      });
      
      // Mark all as error
      setResults(prev => prev.map(r => ({ 
        ...r, 
        status: 'error', 
        error: error.message || String(error) 
      })));
    } finally {
      setRunning(false);
    }
  };

  const copyResultsToClipboard = () => {
    const fullReport = {
      timestamp: new Date().toISOString(),
      project_ref: PROJECT_REF,
      user_id: currentUserId,
      connectivity_results: connectivityResults,
      diagnostic_results: results.map(r => ({
        name: r.name,
        status: r.status,
        data: r.data,
        rawResponse: r.rawResponse,
        error: r.error
      }))
    };
    
    navigator.clipboard.writeText(JSON.stringify(fullReport, null, 2));
    toast({
      title: "Relatório completo copiado!",
      description: "Relatório de conectividade e diagnósticos copiado para a área de transferência.",
    });
  };

  const openFunctionUrl = (url: string, userId: string) => {
    const testUrl = url.includes('diag-scopes') ? `${url}?user_id=${userId}` : url;
    window.open(testUrl, '_blank');
  };

  const getStatusIcon = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'pending':
        return <div className="w-4 h-4 rounded-full bg-muted" />;
      case 'running':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusBadge = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Pendente</Badge>;
      case 'running':
        return <Badge variant="secondary">Executando...</Badge>;
      case 'success':
        return <Badge variant="default" className="bg-green-500">Sucesso</Badge>;
      case 'error':
        return <Badge variant="destructive">Erro</Badge>;
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Diagnósticos Google Drive</h2>
        <div className="flex gap-2">
          <Button
            onClick={copyResultsToClipboard}
            variant="outline"
            size="sm"
            disabled={results.every(r => r.status === 'pending') && connectivityResults.every(r => r.status === 'pending')}
          >
            <Copy className="h-4 w-4 mr-2" />
            Copiar Relatório
          </Button>
          <Button
            onClick={testConnectivity}
            disabled={testingConnectivity}
            variant="outline"
            className="gap-2"
          >
            {testingConnectivity ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Testando...
              </>
            ) : (
              <>
                <Globe className="h-4 w-4" />
                Testar Conectividade
              </>
            )}
          </Button>
          <Button
            onClick={runDiagnostics}
            disabled={running}
            className="gap-2"
          >
            {running ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Executando...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Executar Diagnósticos
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Informações do Projeto */}
      <div className="mb-4 p-3 bg-muted/30 rounded-lg">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><strong>Project Ref:</strong> {PROJECT_REF}</div>
          <div><strong>User ID:</strong> {currentUserId || 'Não obtido ainda'}</div>
        </div>
      </div>

      {/* Teste de Conectividade */}
      <div className="mb-6">
        <h3 className="font-medium mb-3">1. Teste de Conectividade das Funções</h3>
        <div className="space-y-2">
          {connectivityResults.map((connResult, index) => (
            <div key={connResult.name} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
              <div className="flex items-center gap-3">
                {connResult.status === 'pending' && <div className="w-4 h-4 rounded-full bg-muted" />}
                {connResult.status === 'running' && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
                {connResult.status === 'success' && <CheckCircle className="w-4 h-4 text-green-500" />}
                {connResult.status === 'error' && <AlertCircle className="w-4 h-4 text-red-500" />}
                <div>
                  <span className="font-medium">{connResult.name}</span>
                  {connResult.httpStatus && (
                    <span className="ml-2 text-sm text-muted-foreground">HTTP {connResult.httpStatus}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {connResult.accessible ? (
                  <Badge variant="default" className="bg-green-500">Acessível</Badge>
                ) : connResult.status !== 'pending' ? (
                  <Badge variant="destructive">Inacessível</Badge>
                ) : (
                  <Badge variant="secondary">Pendente</Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openFunctionUrl(connResult.url, currentUserId)}
                  disabled={!currentUserId}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Separator className="my-4" />

      {/* Diagnósticos Funcionais */}
      <div>
        <h3 className="font-medium mb-3">2. Diagnósticos Funcionais</h3>

        <div className="space-y-4">
          {results.map((result, index) => (
            <div key={result.name}>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  {getStatusIcon(result.status)}
                  <span className="font-medium">{result.name}</span>
                </div>
                {getStatusBadge(result.status)}
              </div>
              
              {(result.data || result.error || result.rawResponse) && (
                <div className="mt-2">
                  <ScrollArea className="h-40 w-full border rounded-lg p-3 bg-background">
                    <div className="space-y-2">
                      {result.error && (
                        <div className="text-xs text-muted-foreground border-b pb-2">
                          <strong>Info:</strong> {result.error}
                        </div>
                      )}
                      <pre className="text-xs">
                        {JSON.stringify(result.data || result.rawResponse, null, 2)}
                      </pre>
                    </div>
                  </ScrollArea>
                </div>
              )}
              
              {index < results.length - 1 && <Separator className="mt-4" />}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 p-4 bg-muted/30 rounded-lg">
        <h3 className="font-medium mb-2">Critérios de Sucesso:</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• <strong>diag-scopes:</strong> Status 200 com escopos "drive.metadata.readonly" e "drive.file"</li>
          <li>• <strong>diag-list-root:</strong> Status 200 com filesCount e echo.corpora="user"</li>
          <li>• <strong>diag-list-folder:</strong> Status 200 com folderId ecoado (404 se pasta inválida)</li>
        </ul>
        <div className="mt-3 text-xs text-muted-foreground">
          <strong>Problemas comuns:</strong> FunctionsFetchError → verificar conectividade, PROJECT_REF, ANON_KEY
        </div>
      </div>
    </Card>
  );
}