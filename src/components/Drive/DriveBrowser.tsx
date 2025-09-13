import React, { useEffect } from "react";
import { useDriveBrowser } from "@/hooks/useDriveBrowser";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Folder, ArrowLeft, MoreHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function DriveBrowser() {
  const { current, items, next, loading, err, list, enter, back, selectHere } = useDriveBrowser();

  useEffect(() => { 
    list(true); 
  }, [current]);

  const handleSelectFolder = async () => {
    const name = prompt("Nome para exibir (opcional):") || undefined;
    try {
      await selectHere(current, name);
      alert("Pasta definida com sucesso!");
    } catch (e: any) {
      alert(`Erro: ${e.message}`);
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
      alert(`Erro ao reconectar: ${e.message}`);
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
        <div className="flex items-center gap-2">
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
            Pasta atual: {current === "root" ? "Meu Drive" : current}
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
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
            <p className="text-sm text-amber-800">
              Permissões do Drive expiradas.{" "}
              <button
                className="underline hover:no-underline"
                onClick={handleReconnect}
              >
                Reconectar
              </button>
            </p>
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
            <div className="text-sm text-muted-foreground">Carregando...</div>
          </div>
        )}

        {/* Folder List */}
        {!loading && !err && (
          <div className="border rounded-md">
            {items.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Nenhuma pasta encontrada neste local.
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {items.map((folder) => (
                  <div 
                    key={folder.id} 
                    className="flex items-center justify-between p-3 hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
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