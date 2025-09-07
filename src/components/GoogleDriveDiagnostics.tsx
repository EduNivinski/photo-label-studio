import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, CheckCircle, Loader2, Play, Copy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DiagnosticResult {
  name: string;
  status: 'pending' | 'running' | 'success' | 'error';
  data?: any;
  error?: string;
}

export function GoogleDriveDiagnostics() {
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<DiagnosticResult[]>([
    { name: 'diag-scopes', status: 'pending' },
    { name: 'diag-list-root', status: 'pending' },
    { name: 'diag-list-folder', status: 'pending' },
    { name: 'diag-list-shared-drive', status: 'pending' }
  ]);

  const runDiagnostics = async () => {
    setRunning(true);
    
    try {
      // Get current user ID
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('No authenticated user found');
      }

      const USER_ID = user.id;
      console.log('USER_ID', USER_ID);

      // Update all to running
      setResults(prev => prev.map(r => ({ ...r, status: 'running' as const })));

      // Run all diagnostics
      const diagnostics = [
        {
          name: 'diag-scopes',
          fn: () => supabase.functions.invoke("diag-scopes", {
            method: "POST",
            body: { user_id: USER_ID },
          })
        },
        {
          name: 'diag-list-root',
          fn: () => supabase.functions.invoke("diag-list-root", {
            method: "POST",
            body: { user_id: USER_ID },
          })
        },
        {
          name: 'diag-list-folder',
          fn: () => supabase.functions.invoke("diag-list-folder", {
            method: "POST",
            body: { user_id: USER_ID, folderId: "root", folder_id: "root" },
          })
        },
        {
          name: 'diag-list-shared-drive',
          fn: () => supabase.functions.invoke("diag-list-shared-drive", {
            method: "POST",
            body: { user_id: USER_ID },
          })
        }
      ];

      // Run diagnostics sequentially to avoid overwhelming
      for (const diagnostic of diagnostics) {
        try {
          console.log(`Running ${diagnostic.name}...`);
          const result = await diagnostic.fn();
          console.log(`${diagnostic.name.toUpperCase()} →`, result);
          
          setResults(prev => prev.map(r => 
            r.name === diagnostic.name 
              ? { ...r, status: 'success', data: result }
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
    const resultsText = results.map(result => {
      return `${result.name.toUpperCase()}:\n${JSON.stringify(result.data || result.error, null, 2)}\n`;
    }).join('\n');
    
    navigator.clipboard.writeText(resultsText);
    toast({
      title: "Copiado!",
      description: "Resultados copiados para a área de transferência.",
    });
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
            disabled={results.every(r => r.status === 'pending')}
          >
            <Copy className="h-4 w-4 mr-2" />
            Copiar Resultados
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
                Executar Testes
              </>
            )}
          </Button>
        </div>
      </div>

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
            
            {(result.data || result.error) && (
              <div className="mt-2">
                <ScrollArea className="h-32 w-full border rounded-lg p-3 bg-background">
                  <pre className="text-xs">
                    {JSON.stringify(result.data || result.error, null, 2)}
                  </pre>
                </ScrollArea>
              </div>
            )}
            
            {index < results.length - 1 && <Separator className="mt-4" />}
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-muted/30 rounded-lg">
        <h3 className="font-medium mb-2">Critérios de Sucesso:</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• <strong>diag-scopes:</strong> Status 200 com escopos drive.metadata.readonly e drive.file</li>
          <li>• <strong>diag-list-root:</strong> Status 200 com filesCount e echo correto</li>
          <li>• <strong>diag-list-folder:</strong> Status 200 com folderId ecoado</li>
          <li>• <strong>diag-list-shared-drive:</strong> Status 200 (pode estar vazio)</li>
        </ul>
      </div>
    </Card>
  );
}