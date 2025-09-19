import React, { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Cloud, RefreshCw, Loader2 } from "lucide-react";
import { useDriveSync } from "@/hooks/useDriveSync";
import { useToast } from "@/hooks/use-toast";

export default function DriveSyncBadge() {
  const { changes, loading, syncNow, hasNewChanges, checkChanges } = useDriveSync();
  const { toast } = useToast();

  useEffect(() => {
    // Check for changes when component mounts
    checkChanges();
  }, [checkChanges]);

  if (!hasNewChanges || !changes) {
    return null;
  }

  const handleSync = async () => {
    const result = await syncNow();
    if (result.success) {
      toast({
        title: "Sincronização concluída",
        description: `${result.processed} itens processados`,
      });
    } else {
      toast({
        title: "Erro na sincronização",
        description: result.error || "Falha ao sincronizar",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="border-blue-200 bg-blue-50/50 mb-6">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Cloud className="h-5 w-5 text-blue-600" />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-blue-800">
                  Novos itens no Google Drive
                </span>
                <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700">
                  {changes.newCount} itens
                </Badge>
              </div>
              <p className="text-xs text-blue-700">
                {changes.additions > 0 && `${changes.additions} novos`}
                {changes.modifications > 0 && (changes.additions > 0 ? `, ${changes.modifications} atualizados` : `${changes.modifications} atualizados`)}
                {changes.removals > 0 && (changes.additions > 0 || changes.modifications > 0 ? `, ${changes.removals} removidos` : `${changes.removals} removidos`)}
              </p>
            </div>
          </div>
          <Button
            onClick={handleSync}
            variant="outline"
            size="sm"
            disabled={loading}
            className="border-blue-200 text-blue-700 hover:bg-blue-100"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Sincronizar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}