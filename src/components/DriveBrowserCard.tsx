import { Button } from "@/components/ui/button";
import { Folder, ChevronRight, ChevronLeft } from "lucide-react";
import { useDriveBrowser } from "@/hooks/useDriveBrowser";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Props = {
  title?: string; // default: "Navegação no Google Drive"
  onSelectCurrentFolder: (id: string, name: string) => void;
};

export function DriveBrowserCard({
  title = "Navegação no Google Drive",
  onSelectCurrentFolder,
}: Props) {
  const { toast } = useToast();
  const { 
    path, 
    current, 
    items, 
    loading, 
    error, 
    canGoBack, 
    openFolder, 
    goBack, 
    goToCrumb 
  } = useDriveBrowser();

  const handleOpenFolder = (id: string) => {
    const item = items.find(item => item.id === id);
    if (item) {
      openFolder(id, item.name);
    }
  };

  const handleSelectCurrentFolder = () => {
    onSelectCurrentFolder(current.id, current.name);
  };

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      {/* Header: Voltar + Breadcrumb + Selecionar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={goBack} disabled={!canGoBack} title="Voltar">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <nav className="text-sm text-muted-foreground flex items-center gap-1">
            {path.map((p, i) => (
              <span key={p.id} className="flex items-center">
                <button
                  className={`truncate max-w-[160px] ${
                    i === path.length - 1 
                      ? "text-foreground font-medium cursor-default" 
                      : "hover:underline"
                  }`}
                  onClick={() => i !== path.length - 1 && goToCrumb(i)}
                  title={p.name}
                >
                  {p.name}
                </button>
                {i !== path.length - 1 && <ChevronRight className="h-3 w-3 mx-1 opacity-60" />}
              </span>
            ))}
          </nav>
        </div>
        <Button onClick={handleSelectCurrentFolder}>
          <Folder className="h-4 w-4 mr-1" /> Selecionar pasta
        </Button>
      </div>

      {/* Listagem */}
      <div className="mt-3 rounded-md border divide-y">
        {loading && <div className="p-4 text-sm text-muted-foreground">Carregando…</div>}
        {error && !loading && <div className="p-4 text-sm text-red-600">Erro: {error}</div>}
        {!loading && !error && items.length === 0 && (
          <div className="p-4 text-sm text-muted-foreground">Nenhum item nesta pasta.</div>
        )}
        {!loading && !error && items.map((it) => {
          const isFolder = it.mimeType === "application/vnd.google-apps.folder";
          return (
            <button
              key={it.id}
              onClick={() => isFolder && handleOpenFolder(it.id)}
              className="w-full flex items-center justify-between p-3 hover:bg-accent/50 text-left"
              title={it.name}
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