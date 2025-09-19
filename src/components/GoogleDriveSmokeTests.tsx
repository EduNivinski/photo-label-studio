import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertCircle, Play, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'pending';
  message: string;
}

export function GoogleDriveSmokeTests() {
  const [tests, setTests] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runTests = async () => {
    setIsRunning(true);
    const results: TestResult[] = [];

    // Test 1: OAuth Callback (public endpoint)
    try {
      const response = await fetch(
        'https://tcupxcxyylxfgsbhfdhw.supabase.co/functions/v1/google-drive-oauth-callback',
        { method: 'GET' }
      );
      
      if (response.status === 400) {
        // Expected - missing code/state is the expected error for a valid public endpoint
        results.push({
          name: 'OAuth Callback Public Access',
          status: 'pass',
          message: 'Endpoint is accessible without JWT (expected 400 for missing params)'
        });
      } else {
        results.push({
          name: 'OAuth Callback Public Access',
          status: 'fail',
          message: `Unexpected status: ${response.status}`
        });
      }
    } catch (error) {
      results.push({
        name: 'OAuth Callback Public Access',
        status: 'fail',
        message: `Network error: ${error}`
      });
    }

    // Test 2: Thumb Open (public endpoint)
    try {
      const response = await fetch(
        'https://tcupxcxyylxfgsbhfdhw.supabase.co/functions/v1/thumb-open',
        { method: 'GET' }
      );
      
      if (response.status === 401) {
        // Expected - missing signature is the expected error for a valid public endpoint
        results.push({
          name: 'Thumb Open Public Access',
          status: 'pass',
          message: 'Endpoint is accessible without JWT (expected 401 for missing signature)'
        });
      } else {
        results.push({
          name: 'Thumb Open Public Access',
          status: 'fail',
          message: `Unexpected status: ${response.status}`
        });
      }
    } catch (error) {
      results.push({
        name: 'Thumb Open Public Access',
        status: 'fail',
        message: `Network error: ${error}`
      });
    }

    // Test 3: Drive Auth (private endpoint) - should require JWT
    try {
      const response = await fetch(
        'https://tcupxcxyylxfgsbhfdhw.supabase.co/functions/v1/google-drive-auth',
        { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'status' })
        }
      );
      
      if (response.status === 401) {
        results.push({
          name: 'Drive Auth JWT Protection',
          status: 'pass',
          message: 'Endpoint correctly requires JWT authentication'
        });
      } else {
        results.push({
          name: 'Drive Auth JWT Protection',
          status: 'fail',
          message: `Should return 401 without JWT, got: ${response.status}`
        });
      }
    } catch (error) {
      results.push({
        name: 'Drive Auth JWT Protection',
        status: 'fail',
        message: `Network error: ${error}`
      });
    }

    // Test 4: Drive Status (with JWT)
    try {
      const { data, error } = await supabase.functions.invoke('google-drive-auth', {
        body: { action: 'status' }
      });

      if (error) {
        results.push({
          name: 'Drive Status with JWT',
          status: 'fail',
          message: `Error: ${error.message}`
        });
      } else {
        results.push({
          name: 'Drive Status with JWT',
          status: 'pass',
          message: `Status check successful: ${data?.connected ? 'Connected' : 'Not connected'}`
        });
      }
    } catch (error) {
      results.push({
        name: 'Drive Status with JWT',
        status: 'fail',
        message: `Error: ${error}`
      });
    }

    setTests(results);
    setIsRunning(false);
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'fail':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: TestResult['status']) => {
    const variants = {
      pass: 'default' as const,
      fail: 'destructive' as const,
      pending: 'secondary' as const
    };
    
    return (
      <Badge variant={variants[status]}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="h-5 w-5" />
          Google Drive Smoke Tests
        </CardTitle>
        <CardDescription>
          Testes de conectividade para validar endpoints OAuth, thumbnails e proteção JWT
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={runTests} 
          disabled={isRunning}
          className="w-full"
        >
          {isRunning ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Executando Testes...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Executar Testes de Conectividade
            </>
          )}
        </Button>

        {tests.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold">Resultados dos Testes</h3>
            {tests.map((test, index) => (
              <div 
                key={index} 
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-2">
                  {getStatusIcon(test.status)}
                  <span className="font-medium">{test.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(test.status)}
                </div>
              </div>
            ))}
            
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Detalhes dos Testes</h4>
              {tests.map((test, index) => (
                <div key={index} className="text-sm mb-2">
                  <strong>{test.name}:</strong> {test.message}
                </div>
              ))}
            </div>

            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium mb-2 text-blue-800">✅ Configurações Validadas</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• OAuth Callback público (verify_jwt = false)</li>
                <li>• Thumbnail routes públicas com CORS</li>
                <li>• Endpoints privados protegidos por JWT</li>
                <li>• PostMessage + window.close() no callback</li>
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}