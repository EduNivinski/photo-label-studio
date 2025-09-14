import { Button } from "@/components/ui/button";
import { Folder, ChevronRight, ChevronLeft } from "lucide-react";

type DriveItem = { id: string; name: string; mimeType: string; trashed?: boolean };
type Props = {
  title?: string; // default: "Navegação no Google Drive"
  path: { id: string; name: string }[]; // breadcrumb
  items: DriveItem[];
  canGoBack: boolean;
  onBack: () => void;
  onOpenFolder: (id: string) => void;
  onSelectCurrentFolder: () => void; // usa a pasta do topo (path[path.length-1])
};

export function DriveBrowserCard({
  title = "Navegação no Google Drive",
  path,
  items,
  canGoBack,
  onBack,
  onOpenFolder,
  onSelectCurrentFolder,
}: Props) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack} disabled={!canGoBack} title="Voltar">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-sm text-muted-foreground flex items-center gap-1">
            {path.map((p, i) => (
              <span key={p.id} className="flex items-center">
                <span className={i === path.length - 1 ? "text-foreground font-medium" : "hover:underline cursor-pointer"}
                      onClick={() => i !== path.length - 1 && onOpenFolder(p.id)}>
                  {p.name}
                </span>
                {i !== path.length - 1 && <ChevronRight className="h-3 w-3 mx-1 opacity-60" />}
              </span>
            ))}
          </div>
        </div>
        <Button onClick={onSelectCurrentFolder}>
          <Folder className="h-4 w-4 mr-1" /> Selecionar pasta
        </Button>
      </div>

      <div className="mt-3 divide-y rounded-md border">
        {items.length === 0 && (
          <div className="p-4 text-sm text-muted-foreground">Nenhum item nesta pasta.</div>
        )}
        {items.map((it) => {
          const isFolder = it.mimeType === "application/vnd.google-apps.folder";
          return (
            <button
              key={it.id}
              onClick={() => isFolder && onOpenFolder(it.id)}
              className="w-full flex items-center justify-between p-3 hover:bg-accent/50 text-left"
            >
              <div className="flex items-center gap-2">
                <Folder className="h-4 w-4" />
                <span className="truncate">{it.name}</span>
              </div>
              {isFolder && <ChevronRight className="h-4 w-4 opacity-60" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}