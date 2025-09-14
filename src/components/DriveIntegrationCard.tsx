import { RefreshCcw, PlugZap, KeySquare, Unlink, Folder } from "lucide-react";
import { Button } from "@/components/ui/button";
import StatusPill from "./StatusPill";

type Props = {
  state: "connected" | "checking" | "disconnected" | "error";
  dedicatedFolderPath?: string | null;
  onCheck: () => void;
  onReconnect: () => void;
  onReconnectWithConsent: () => void;
  onDisconnect: () => void;
  onChooseFolder: () => void;
};

export function DriveIntegrationCard({
  state,
  dedicatedFolderPath,
  onCheck,
  onReconnect,
  onReconnectWithConsent,
  onDisconnect,
  onChooseFolder,
}: Props) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      {/* Header: Título + Status */}
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Integração Google Drive</h3>
        <StatusPill state={state} />
      </div>

      {/* Ações secundárias */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={onCheck}><RefreshCcw className="h-4 w-4 mr-1" /> Verificar status</Button>
        <Button variant="outline" onClick={onReconnect}><PlugZap className="h-4 w-4 mr-1" /> Reconectar</Button>
        <Button variant="outline" onClick={onReconnectWithConsent}><KeySquare className="h-4 w-4 mr-1" /> Reconectar com permissões</Button>
        <Button variant="destructive" onClick={onDisconnect}><Unlink className="h-4 w-4 mr-1" /> Desconectar</Button>
      </div>

      {/* Linha inferior: caminho (esq) + botão (dir) */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground truncate" title={dedicatedFolderPath || "Nenhuma pasta selecionada"}>
          {dedicatedFolderPath
            ? <>Pasta selecionada: <span className="font-medium text-foreground">{dedicatedFolderPath}</span></>
            : <>Nenhuma pasta selecionada</>}
        </div>
        <Button onClick={onChooseFolder}><Folder className="h-4 w-4 mr-1" /> Selecionar pasta</Button>
      </div>
    </div>
  );
}