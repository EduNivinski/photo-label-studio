import { RefreshCcw, PlugZap, KeySquare, Unlink, Folder, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import StatusPill from "./StatusPill";

type Props = {
  state: "connected" | "checking" | "disconnected" | "error";
  dedicatedFolderPath?: string | null;
  onCheck: () => void;
  onConnect: () => void;
  onReconnect: () => void;
  onReconnectWithConsent: () => void;
  onDisconnect: () => void;
  onChooseFolder: () => void;
  preflightResult?: { ok: boolean; reason?: string } | null;
  preflightLoading?: boolean;
};

export function DriveIntegrationCard({
  state,
  dedicatedFolderPath,
  onCheck,
  onConnect,
  onReconnect,
  onReconnectWithConsent,
  onDisconnect,
  onChooseFolder,
  preflightResult,
  preflightLoading,
}: Props) {
  const isCallbackBlocked = preflightResult && !preflightResult.ok && preflightResult.reason === "GATEWAY_JWT_ON";
  const shouldDisableConnectButtons = isCallbackBlocked;

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm space-y-4">
      {/* Preflight Warning Banner */}
      {isCallbackBlocked && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Callback do Google está protegido por JWT no gateway. Peça ao suporte para desligar Verify JWT desta função.
          </AlertDescription>
        </Alert>
      )}

      {/* Header: Título + Status */}
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Integração Google Drive</h3>
        <StatusPill state={preflightLoading ? "checking" : state} />
      </div>

      {/* Ações secundárias */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={onCheck}><RefreshCcw className="h-4 w-4 mr-1" /> Verificar status</Button>
        <Button 
          variant="outline" 
          onClick={onConnect}
          disabled={shouldDisableConnectButtons}
          className="border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800"
        >
          <PlugZap className="h-4 w-4 mr-1" /> Conectar
        </Button>
        <Button 
          variant="outline" 
          onClick={onReconnectWithConsent}
          disabled={shouldDisableConnectButtons}
          className="hidden"
        >
          <KeySquare className="h-4 w-4 mr-1" /> Reconectar com permissões
        </Button>
        <Button variant="destructive" onClick={onDisconnect}><Unlink className="h-4 w-4 mr-1" /> Desconectar</Button>
      </div>

      {/* Linha inferior: caminho (esq) + botão (dir) */}
      <div className="flex items-center justify-between gap-3">
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