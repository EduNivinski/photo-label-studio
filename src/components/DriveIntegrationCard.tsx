import { Button } from "@/components/ui/button";
import { PlugZap, RefreshCcw, KeySquare, Link, Unlink } from "lucide-react";
import StatusPill from "./StatusPill";

type Props = {
  state: "connected" | "checking" | "disconnected" | "error";
  dedicatedFolderPath?: string | null; // ex.: "Meu Drive / Fotos / Viagens"
  onCheck: () => void;
  onReconnect: () => void;
  onReconnectWithConsent: () => void;
  onDisconnect: () => void;
  onChooseFolder: () => void; // abre o navegador de pastas
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
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold">Integração Google Drive</h3>
          <StatusPill state={state} />
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={onChooseFolder} className="h-9" title="Escolher pasta">
            <Link className="h-4 w-4 mr-1" /> Selecionar pasta
          </Button>
        </div>
      </div>

      {/* Pasta atual (inline, sem card separado) */}
      <div className="mt-3 text-sm text-muted-foreground">
        {dedicatedFolderPath
          ? <>Pasta selecionada: <span className="font-medium text-foreground">{dedicatedFolderPath}</span></>
          : <>Nenhuma pasta selecionada.</>}
      </div>

      {/* Grupo de ações secundárias */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={onCheck} title="Verificar status">
          <RefreshCcw className="h-4 w-4 mr-1" /> Verificar status
        </Button>
        <Button variant="outline" onClick={onReconnect} title="Reconectar">
          <PlugZap className="h-4 w-4 mr-1" /> {state === "disconnected" ? "Conectar" : "Reconectar"}
        </Button>
        <Button variant="outline" onClick={onReconnectWithConsent} title="Reconectar com permissões">
          <KeySquare className="h-4 w-4 mr-1" /> Reconectar com permissões
        </Button>
        <Button variant="destructive" onClick={onDisconnect} title="Desconectar">
          <Unlink className="h-4 w-4 mr-1" /> Desconectar
        </Button>
      </div>
    </div>
  );
}