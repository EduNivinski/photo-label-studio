import { Folder } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  dedicatedFolderPath?: string | null;
  onChooseFolder: () => void;
  disabled?: boolean;
};

export function DriveFolderSelectionCard({
  dedicatedFolderPath,
  onChooseFolder,
  disabled = false,
}: Props) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
      <h3 className="text-lg font-semibold">Pasta de Backup</h3>
      
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground flex-1 min-w-0">
          {dedicatedFolderPath ? (
            <div className="flex items-center gap-1">
              <span className="shrink-0">Pasta selecionada:</span>
              <span 
                className="font-medium text-foreground truncate block" 
                style={{ direction: 'rtl', textAlign: 'left' }}
                title={dedicatedFolderPath}
              >
                {dedicatedFolderPath}
              </span>
            </div>
          ) : (
            <span>Nenhuma pasta selecionada</span>
          )}
        </div>
        <Button onClick={onChooseFolder} disabled={disabled} className="shrink-0">
          <Folder className="h-4 w-4 mr-1" /> Buscar pasta
        </Button>
      </div>
    </div>
  );
}
