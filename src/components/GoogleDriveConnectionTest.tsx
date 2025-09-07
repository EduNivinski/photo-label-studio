import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { useGoogleDrive } from '@/hooks/useGoogleDrive';

export function GoogleDriveConnectionTest() {
  const { status, loading } = useGoogleDrive();

  const getStatusIcon = () => {
    if (loading) return <Clock className="h-5 w-5 animate-spin text-blue-500" />;
    if (status.isConnected && !status.isExpired) return <CheckCircle className="h-5 w-5 text-green-500" />;
    if (status.isConnected && status.isExpired) return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    return <XCircle className="h-5 w-5 text-red-500" />;
  };

  const getStatusText = () => {
    if (loading) return 'Verificando...';
    if (status.isConnected && !status.isExpired) return 'Conectado e Ativo';
    if (status.isConnected && status.isExpired) return 'Conectado - Token Expirado';
    return 'Desconectado';
  };

  const getStatusVariant = () => {
    if (loading) return 'secondary';
    if (status.isConnected && !status.isExpired) return 'default';
    if (status.isConnected && status.isExpired) return 'destructive';
    return 'secondary';
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getStatusIcon()}
          Status da Conexão
        </CardTitle>
        <CardDescription>
          Status em tempo real da integração Google Drive
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Status:</span>
          <Badge variant={getStatusVariant()}>
            {getStatusText()}
          </Badge>
        </div>
        
        {status.isConnected && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Token Status:</span>
              <Badge variant={status.isExpired ? 'destructive' : 'default'}>
                {status.isExpired ? 'Expirado' : 'Válido'}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Pasta Dedicada:</span>
              <Badge variant={status.dedicatedFolder ? 'default' : 'secondary'}>
                {status.dedicatedFolder ? status.dedicatedFolder.name : 'Não configurada'}
              </Badge>
            </div>
          </>
        )}
        
        <div className="pt-2 border-t">
          <div className="text-xs text-muted-foreground">
            <p><strong>✅ Sistema de Segurança:</strong></p>
            <ul className="mt-1 space-y-1">
              <li>• Tokens criptografados no Supabase Vault</li>
              <li>• Validação de entrada implementada</li>
              <li>• Logs de auditoria ativos</li>
              <li>• Rate limiting configurado</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}