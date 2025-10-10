import React, { useState } from "react";
import { useDriveBrowser } from "@/hooks/useDriveBrowser";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Folder, ArrowLeft, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DriveBrowserProps {
  onFolderSelected?: (folder: { id: string; name: string }) => void;
}

export default function DriveBrowser({ onFolderSelected }: DriveBrowserProps) {
  const { current, items, loading, error, canGoBack, openFolder, goBack } = useDriveBrowser();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const onSelectFolder = async (folder: { id: string; name: string }) => {
    try {
      setSaving(true);
      const { data, error } = await supabase.functions.invoke("google-drive-auth", {
        body: { action: "set_folder", folderId: folder.id, folderName: folder.name }
      });
      if (error || !data?.ok) throw new Error(data?.reason || error?.message || "SET_FOLDER_FAILED");

      // Confirmação inline
      toast({
        title: "Pasta selecionada",
        description: `Pasta selecionada: ${data.dedicatedFolderName}`,
      });

      // Atualizar status na UI
      const st = await supabase.functions.invoke("google-drive-auth", { body: { action: "status" }});
      
      // Update parent component
      onFolderSelected?.({ id: folder.id, name: data.dedicatedFolderName });
      
    } catch (e: any) {
      toast({
        title: "Erro",
        description: `Não foi possível selecionar a pasta: ${e?.message || e}`,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSelectCurrentFolder = async () => {
    await onSelectFolder({ id: current.id, name: current.name });
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
            onClick={goBack} 
            disabled={!canGoBack} 
            variant="outline" 
            size="sm"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar
          </Button>
          <div className="text-sm text-muted-foreground flex-1">
            📁 {current.name}
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleSelectCurrentFolder}
              size="sm"
              disabled={saving}
              className="bg-purple-400 text-white hover:bg-purple-500"
            >
              {saving ? "Selecionando..." : "Selecionar esta pasta"}
            </Button>
            <Button
              onClick={() => {
                // Funcionalidade será implementada futuramente
                toast({
                  title: "Em breve",
                  description: "Funcionalidade de sincronização de pasta em desenvolvimento",
                });
              }}
              variant="outline"
              size="sm"
              className="border-green-200 text-green-700 hover:bg-green-50"
            >
              Sincronizar pasta
            </Button>
          </div>
        </div>

        {/* Error States */}
        {error === "NEEDS_RECONSENT" && (
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

        {error && error !== "NEEDS_RECONSENT" && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">Erro: {error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-muted-foreground">Carregando pastas...</div>
          </div>
        )}

        {/* Folder List */}
        {!loading && !error && (
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
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => openFolder(folder.id, folder.name)}
                        variant="outline"
                        size="sm"
                      >
                        Abrir
                      </Button>
                      <Button
                        onClick={() => onSelectFolder({ id: folder.id, name: folder.name })}
                        variant="default"
                        size="sm"
                        disabled={saving}
                      >
                        Selecionar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}