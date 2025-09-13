import React, { useEffect } from "react";
import { useDriveBrowser } from "@/hooks/useDriveBrowser";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Folder, ArrowLeft, MoreHorizontal, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DriveBrowserProps {
  onFolderSelected?: (folder: { id: string; name: string }) => void;
}

export default function DriveBrowser({ onFolderSelected }: DriveBrowserProps) {
  const { current, items, next, loading, err, list, enter, back, selectHere } = useDriveBrowser();
  const { toast } = useToast();

  useEffect(() => { 
    list(true); 
  }, [current]);

  const handleSelectFolder = async () => {
    const name = prompt("Nome para exibir (opcional):") || undefined;
    try {
      await selectHere(current, name);
      const folderName = name || (current === "root" ? "Meu Drive" : current);
      onFolderSelected?.({ id: current, name: folderName });
      toast({
        title: "Pasta selecionada",
        description: `Pasta "${folderName}" foi definida como pasta de backup`,
      });
    } catch (e: any) {
      toast({
        title: "Erro",
        description: `Erro ao selecionar pasta: ${e.message}`,
        variant: "destructive",
      });
    }
  };

  const handleReconnect = async () => {
    try {
      const result = await supabase.functions.invoke("google-drive-auth", {
        body: { 
          action: "authorize", 
          redirect: window.location.origin + "/settings/drive", 
          forceConsent: true 
        }
      });
      if (result.data?.authorizeUrl) {
        window.open(result.data.authorizeUrl, "_blank", "width=520,height=720");
      }
    } catch (e: any) {
      toast({
        title: "Erro",
        description: `Erro ao reconectar: ${e.message}`,
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Folder className="h-5 w-5" />
          Explorador do Google Drive
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Navigation Bar */}
        <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
          <Button 
            onClick={back} 
            disabled={current === "root"} 
            variant="outline" 
            size="sm"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar
          </Button>
          <div className="text-sm text-muted-foreground flex-1">
            📁 {current === "root" ? "Meu Drive" : current}
          </div>
          <Button
            onClick={handleSelectFolder}
            variant="default"
            size="sm"
          >
            Selecionar esta pasta
          </Button>
        </div>

        {/* Error States */}
        {err === "NEEDS_RECONSENT" && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">Permissões do Drive expiradas</p>
                <p className="text-sm text-amber-700 mb-3">
                  É necessário reconectar com as permissões necessárias para acessar suas pastas.
                </p>
                <Button
                  onClick={handleReconnect}
                  size="sm"
                  variant="outline"
                  className="border-amber-300 text-amber-800 hover:bg-amber-100"
                >
                  Reconectar
                </Button>
              </div>
            </div>
          </div>
        )}

        {err && err !== "NEEDS_RECONSENT" && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">Erro: {err}</p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-muted-foreground">Carregando pastas...</div>
          </div>
        )}

        {/* Folder List */}
        {!loading && !err && (
          <div className="border rounded-md">
            {items.length === 0 ? (
              <div className="p-6 text-center">
                <Folder className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma pasta encontrada neste local.
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {items.map((folder) => (
                  <div 
                    key={folder.id} 
                    className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Folder className="h-4 w-4 text-blue-500 flex-shrink-0" />
                      <span className="text-sm truncate">{folder.name}</span>
                    </div>
                    <Button
                      onClick={() => enter(folder.id)}
                      variant="outline"
                      size="sm"
                    >
                      Abrir
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Load More */}
        {next && !loading && (
          <div className="flex justify-center">
            <Button 
              onClick={() => list(false)} 
              variant="outline"
            >
              <MoreHorizontal className="h-4 w-4 mr-1" />
              Carregar mais
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}