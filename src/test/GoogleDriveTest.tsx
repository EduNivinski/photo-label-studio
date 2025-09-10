import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

export const GoogleDriveTest = () => {
  const [status, setStatus] = useState<string>('Ready');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testConnection = async () => {
    setLoading(true);
    setStatus('Testing connection...');
    
    try {
      const { data, error } = await supabase.functions.invoke('google-drive-auth/status');
      
      if (error) {
        setStatus('Error');
        setResult({ error: error.message });
      } else {
        setStatus('Success');
        setResult(data);
      }
    } catch (error) {
      setStatus('Failed');
      setResult({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setLoading(false);
    }
  };

  const testAuthorize = async () => {
    setLoading(true);
    setStatus('Testing authorize endpoint...');
    
    try {
      // Usar o novo fluxo POST simplificado
      const { data, error } = await supabase.functions.invoke("google-drive-auth", {
        body: { 
          action: "authorize", 
          redirect: window.location.origin + "/google-drive" 
        },
      });
      
      
      if (error) {
        setStatus('Error');
        setResult({ error: error.message });
      } else if (data?.authorizeUrl) {
        setStatus('Opening redirect...');
        window.location.href = data.authorizeUrl;
        setResult({ redirect: 'opened', url: data.authorizeUrl });
      } else {
        setStatus('No URL returned');
        setResult(data);
      }
    } catch (error) {
      setStatus('Failed');
      setResult({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setLoading(false);
    }
  };

  const getBadgeColor = (status: string) => {
    switch (status) {
      case 'Success': return 'default';
      case 'Error': case 'Failed': return 'destructive';
      case 'Ready': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <Card className="p-6 max-w-2xl mx-auto">
      <h2 className="text-xl font-semibold mb-4">Google Drive Test Console</h2>
      
      <div className="flex items-center gap-2 mb-4">
        <span>Status:</span>
        <Badge variant={getBadgeColor(status)}>{status}</Badge>
      </div>

      <div className="flex gap-2 mb-4">
        <Button 
          onClick={testConnection} 
          disabled={loading}
          variant="outline"
        >
          Test Connection Status
        </Button>
        
        <Button 
          onClick={testAuthorize} 
          disabled={loading}
          variant="default"
        >
          Test Authorization Flow
        </Button>
      </div>

      {result && (
        <div className="mt-4">
          <h3 className="font-medium mb-2">Result:</h3>
          <pre className="bg-muted p-3 rounded text-sm overflow-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}

      <div className="mt-4 text-sm text-muted-foreground">
        <p><strong>Instructions:</strong></p>
        <ul className="list-disc list-inside space-y-1">
          <li><strong>Test Connection Status:</strong> Check if user has Google Drive tokens</li>
          <li><strong>Test Authorization Flow:</strong> Open Google OAuth popup</li>
          <li>Make sure you're logged in to the app first</li>
          <li>All responses should return JSON with proper CORS headers</li>
        </ul>
      </div>
    </Card>
  );
};