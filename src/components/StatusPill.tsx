import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

type Props = { state: "connected" | "checking" | "disconnected" | "error"; className?: string };

export default function StatusPill({ state, className = "" }: Props) {
  const map = {
    connected: { text: "Conectado", icon: <CheckCircle2 className="h-4 w-4" />, color: "text-green-600", bg: "bg-green-50" },
    checking: { text: "Verificando…", icon: <Loader2 className="h-4 w-4 animate-spin" />, color: "text-amber-600", bg: "bg-amber-50" },
    disconnected: { text: "Desconectado", icon: <XCircle className="h-4 w-4" />, color: "text-red-600", bg: "bg-red-50" },
    error: { text: "Erro", icon: <XCircle className="h-4 w-4" />, color: "text-red-600", bg: "bg-red-50" },
  } as const;
  const s = map[state] ?? map.disconnected;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs ${s.bg} ${s.color} ${className}`}>
      {s.icon}<span>{s.text}</span>
    </span>
  );
}