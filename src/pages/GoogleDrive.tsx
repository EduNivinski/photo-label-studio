import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Cloud, Folder, FileImage, Upload, Download } from 'lucide-react';
import GoogleDriveIntegration from '@/components/GoogleDriveIntegration';

export default function GoogleDrive() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/30 backdrop-blur-sm">
        <div className="container mx-auto px-4 p-6 max-w-7xl">
          <div className="flex items-center gap-3">
            <Cloud className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold text-foreground tracking-tight">
                Google Drive
              </h1>
              <p className="text-muted-foreground mt-1">
                Conecte e sincronize suas fotos com o Google Drive
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-4xl space-y-8">
        
        {/* Benefícios da Integração */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="text-center">
            <CardContent className="pt-6">
              <Folder className="h-12 w-12 mx-auto mb-4 text-blue-500" />
              <CardTitle className="text-lg mb-2">Pasta Dedicada</CardTitle>
              <CardDescription>
                Escolha uma pasta específica do seu Google Drive para organizar todas as fotos do Photo Label
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="pt-6">
              <Upload className="h-12 w-12 mx-auto mb-4 text-green-500" />
              <CardTitle className="text-lg mb-2">Backup Automático</CardTitle>
              <CardDescription>
                Seus uploads no Photo Label podem ser automaticamente salvos no Google Drive como backup
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="pt-6">
              <Download className="h-12 w-12 mx-auto mb-4 text-purple-500" />
              <CardTitle className="text-lg mb-2">Importação Fácil</CardTitle>
              <CardDescription>
                Importe fotos e vídeos existentes do seu Google Drive diretamente para o Photo Label
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* Integração Principal */}
        <GoogleDriveIntegration />

        {/* Informações de Segurança */}
        <Card className="bg-muted/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="h-2 w-2 bg-green-500 rounded-full"></div>
              Implementação Simplificada
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-medium mb-2">⚠️ Armazenamento Local</h4>
                <p className="text-muted-foreground">
                  Esta versão armazena tokens no localStorage do navegador para contornar problemas do Vault
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-2">🎯 Acesso Limitado</h4>
                <p className="text-muted-foreground">
                  Usamos apenas escopos 'drive.file' e 'drive.readonly' - acesso limitado
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-2">🔄 Controle Total</h4>
                <p className="text-muted-foreground">
                  Você pode desconectar a qualquer momento e todos os dados locais são removidos
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-2">🚧 Demo/Teste</h4>
                <p className="text-muted-foreground">
                  Esta é uma versão simplificada para testes - não é adequada para produção
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Como Usar */}
        <Card>
          <CardHeader>
            <CardTitle>Como Usar a Integração</CardTitle>
            <CardDescription>
              Siga estes passos simples para configurar a sincronização com o Google Drive
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                  1
                </div>
                <div>
                  <h4 className="font-medium">Conectar Conta</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Clique em "Conectar Google Drive" e autorize o Photo Label a acessar sua conta
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                  2
                </div>
                <div>
                  <h4 className="font-medium">Escolher Pasta Dedicada</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Selecione uma pasta específica onde todas as fotos do Photo Label serão organizadas
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                  3
                </div>
                <div>
                  <h4 className="font-medium">Sincronizar e Importar</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Importe fotos existentes ou configure backup automático para novos uploads
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}