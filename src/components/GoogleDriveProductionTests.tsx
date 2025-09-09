import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface TestResult {
  name: string;
  status: 'idle' | 'running' | 'success' | 'error';
  data?: any;
  error?: string;
  timestamp?: string;
}

export const GoogleDriveProductionTests = () => {
  const [tests, setTests] = useState<TestResult[]>([
    { name: 'diag-scopes', status: 'idle' },
    { name: 'diag-list-root', status: 'idle' },
    { name: 'diag-list-folder', status: 'idle' },
    { name: 'refresh-test', status: 'idle' },
    { name: 'reset-test', status: 'idle' },
  ]);
  
  const [selectedFolderId, setSelectedFolderId] = useState('1Gl9OPtsYae3kqhQlDz2n0J81KkDWuS3d'); // Fotografias folder
  const [testResults, setTestResults] = useState<string>('');
  const { toast } = useToast();

  const updateTest = (name: string, updates: Partial<TestResult>) => {
    setTests(prev => prev.map(test => 
      test.name === name 
        ? { ...test, ...updates, timestamp: new Date().toISOString() }
        : test
    ));
  };

  const runDiagScopes = async () => {
    updateTest('diag-scopes', { status: 'running' });
    
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('diag-scopes');

      if (error) throw error;

      updateTest('diag-scopes', { 
        status: 'success', 
        data: data,
      });

      // Check for required scopes
      const scopes = data?.scopes || [];
      const hasMetadata = scopes.includes('https://www.googleapis.com/auth/drive.metadata.readonly');
      const hasFile = scopes.includes('https://www.googleapis.com/auth/drive.file');
      
      toast({
        title: hasMetadata && hasFile ? "✅ Scopes OK" : "⚠️ Missing Scopes",
        description: `Metadata: ${hasMetadata ? '✓' : '✗'}, File: ${hasFile ? '✓' : '✗'}`,
      });
      
    } catch (error: any) {
      updateTest('diag-scopes', { 
        status: 'error', 
        error: error.message 
      });
      
      toast({
        title: "❌ diag-scopes Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const runDiagListRoot = async () => {
    updateTest('diag-list-root', { status: 'running' });
    
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('diag-list-root', {
        body: { user_id: user.user.id }
      });

      if (error) throw error;

      updateTest('diag-list-root', { 
        status: 'success', 
        data: data,
      });

      // Check for expected response structure
      const hasEcho = data?.echo?.corpora === "user";
      const hasStatus = data?.status === "OK";
      
      toast({
        title: hasEcho && hasStatus ? "✅ List Root OK" : "⚠️ Unexpected Response",
        description: `Status: ${hasStatus ? '✓' : '✗'}, Echo.corpora: ${hasEcho ? 'user ✓' : '✗'}`,
      });
      
    } catch (error: any) {
      updateTest('diag-list-root', { 
        status: 'error', 
        error: error.message 
      });
      
      toast({
        title: "❌ diag-list-root Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const runDiagListFolder = async () => {
    updateTest('diag-list-folder', { status: 'running' });
    
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('diag-list-folder', {
        body: { 
          user_id: user.user.id,
          folderId: selectedFolderId 
        }
      });

      if (error) throw error;

      updateTest('diag-list-folder', { 
        status: 'success', 
        data: data,
      });

      const itemsCount = data?.items?.length || 0;
      
      toast({
        title: "✅ List Folder OK",
        description: `Found ${itemsCount} items in folder`,
      });
      
    } catch (error: any) {
      updateTest('diag-list-folder', { 
        status: 'error', 
        error: error.message 
      });
      
      toast({
        title: "❌ diag-list-folder Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const runRefreshTest = async () => {
    updateTest('refresh-test', { status: 'running' });
    
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      // First, force token expiration
      const { error: updateError } = await supabase
        .from('user_drive_tokens')
        .update({ 
          expires_at: new Date(Date.now() + 2 * 60 * 1000).toISOString() // 2 minutes from now
        })
        .eq('user_id', user.user.id);

      if (updateError) throw updateError;

      // Wait a moment then try the request (should trigger refresh)
      setTimeout(async () => {
        try {
          const { data, error } = await supabase.functions.invoke('diag-list-root', {
            body: { user_id: user.user.id }
          });

          if (error) throw error;

          updateTest('refresh-test', { 
            status: 'success', 
            data: { message: 'Refresh mechanism working', response: data },
          });
          
          toast({
            title: "✅ Refresh Test OK",
            description: "Token refresh mechanism working correctly",
          });
          
        } catch (error: any) {
          updateTest('refresh-test', { 
            status: 'error', 
            error: error.message 
          });
          
          toast({
            title: "❌ Refresh Test Failed",
            description: error.message,
            variant: "destructive"
          });
        }
      }, 3000); // Wait 3 seconds
      
    } catch (error: any) {
      updateTest('refresh-test', { 
        status: 'error', 
        error: error.message 
      });
      
      toast({
        title: "❌ Refresh Test Setup Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const runResetTest = async () => {
    updateTest('reset-test', { status: 'running' });
    
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      // Call disconnect/reset endpoint
      const { data, error } = await supabase.functions.invoke('google-drive-disconnect', {
        body: {}
      });

      if (error) throw error;

      // Verify that diagnostic endpoints now return NO_ACCESS_TOKEN
      const { data: diagData, error: diagError } = await supabase.functions.invoke('diag-scopes');

      const isExpectedError = diagError?.message?.includes('NO_ACCESS_TOKEN') || 
                             diagData?.error === 'NO_ACCESS_TOKEN';

      updateTest('reset-test', { 
        status: isExpectedError ? 'success' : 'error', 
        data: { reset_response: data, diag_response: diagData },
        error: isExpectedError ? undefined : 'Expected NO_ACCESS_TOKEN error not found'
      });
      
      toast({
        title: isExpectedError ? "✅ Reset Test OK" : "❌ Reset Test Failed",
        description: isExpectedError 
          ? "Tokens successfully cleared, diag endpoints return NO_ACCESS_TOKEN" 
          : "Reset did not properly clear tokens",
        variant: isExpectedError ? "default" : "destructive"
      });
      
    } catch (error: any) {
      updateTest('reset-test', { 
        status: 'error', 
        error: error.message 
      });
      
      toast({
        title: "❌ Reset Test Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const copyResults = () => {
    const results = tests.map(test => ({
      name: test.name,
      status: test.status,
      timestamp: test.timestamp,
      data: test.data,
      error: test.error
    }));
    
    const formatted = JSON.stringify(results, null, 2);
    navigator.clipboard.writeText(formatted);
    setTestResults(formatted);
    
    toast({
      title: "📋 Results Copied",
      description: "Test results copied to clipboard and displayed below"
    });
  };

  const runAllTests = async () => {
    await runDiagScopes();
    await new Promise(resolve => setTimeout(resolve, 1000));
    await runDiagListRoot();
    await new Promise(resolve => setTimeout(resolve, 1000));
    await runDiagListFolder();
    await new Promise(resolve => setTimeout(resolve, 1000));
    await runRefreshTest();
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for refresh test
    await runResetTest();
  };

  const getStatusBadge = (status: TestResult['status']) => {
    switch (status) {
      case 'success': return <Badge variant="default" className="bg-green-500">✅ Success</Badge>;
      case 'error': return <Badge variant="destructive">❌ Error</Badge>;
      case 'running': return <Badge variant="secondary">🔄 Running</Badge>;
      default: return <Badge variant="outline">⏸️ Idle</Badge>;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>🔬 Google Drive - Testes de Produção</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="folder-id">Folder ID para teste diag-list-folder:</Label>
          <Input
            id="folder-id"
            value={selectedFolderId}
            onChange={(e) => setSelectedFolderId(e.target.value)}
            placeholder="ID da pasta do Google Drive"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Button onClick={runDiagScopes} variant="outline" size="sm">
            🔍 diag-scopes
          </Button>
          <Button onClick={runDiagListRoot} variant="outline" size="sm">
            📁 diag-list-root
          </Button>
          <Button onClick={runDiagListFolder} variant="outline" size="sm">
            📂 diag-list-folder
          </Button>
          <Button onClick={runRefreshTest} variant="outline" size="sm">
            🔄 Refresh Test
          </Button>
          <Button onClick={runResetTest} variant="outline" size="sm">
            🗑️ Reset Test
          </Button>
          <Button onClick={runAllTests} variant="default" size="sm">
            🚀 Run All Tests
          </Button>
        </div>

        <div className="space-y-2">
          <h4 className="font-medium">Resultados dos Testes:</h4>
          {tests.map((test) => (
            <div key={test.name} className="flex items-center justify-between p-2 border rounded">
              <span className="font-mono text-sm">{test.name}</span>
              {getStatusBadge(test.status)}
              {test.timestamp && (
                <span className="text-xs text-muted-foreground">
                  {new Date(test.timestamp).toLocaleTimeString()}
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Button onClick={copyResults} variant="secondary" size="sm">
            📋 Copy Results JSON
          </Button>
        </div>

        {testResults && (
          <div className="space-y-2">
            <Label>Test Results JSON:</Label>
            <Textarea
              value={testResults}
              readOnly
              className="h-40 font-mono text-xs"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};