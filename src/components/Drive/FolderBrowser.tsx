import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type DriveItem = {
  id: string;
  name: string;
  mimeType?: string;
};

type Folder = { id: string; name: string };

type Props = {
  onSelect: (folder: Folder) => void;
  defaultFolder?: Folder; // { id: "root", name: "Meu Drive" } por padrão
};

export default function FolderBrowser({ onSelect, defaultFolder }: Props) {
  const [stack, setStack] = useState<Folder[]>([ defaultFolder ?? { id: "root", name: "Meu Drive" } ]);
  const [items, setItems] = useState<DriveItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const busyRef = useRef(false);

  const current = stack[stack.length - 1];

  const isFolder = (it: DriveItem) => it.mimeType === "application/vnd.google-apps.folder";

  const filtered = useMemo(() => {
    if (!filter) return items;
    const q = filter.toLowerCase();
    return items.filter((it) => it.name?.toLowerCase().includes(q));
  }, [filter, items]);

  const load = useCallback(async (folder: Folder, pageToken?: string | null) => {
    setLoading(true);
    try {
      let resp;
      if (folder.id === "root") {
        resp = await supabase.functions.invoke("diag-list-root", { body: pageToken ? { pageToken } : {} });
      } else {
        resp = await supabase.functions.invoke("diag-list-folder", {
          body: pageToken ? { folderId: folder.id, pageToken } : { folderId: folder.id },
        });
      }
      const data = resp.data || {};
      const newItems: DriveItem[] = data.files || data.items || [];
      const token: string | null = data.nextPageToken || null;

      if (pageToken) {
        setItems((prev) => prev.concat(newItems));
      } else {
        setItems(newItems);
      }
      setNextPageToken(token);
    } catch (e) {
      console.error("Drive list error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  // inicial
  useEffect(() => {
    load(current, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.id]);

  const enterFolder = async (it: DriveItem) => {
    if (!isFolder(it) || busyRef.current) return;
    busyRef.current = true;
    try {
      const next: Folder = { id: it.id, name: it.name || "Pasta" };
      setStack((s) => [...s, next]);
      // o effect de cima carregará o conteúdo
    } finally {
      setTimeout(() => (busyRef.current = false), 300);
    }
  };

  const goUp = () => {
    if (stack.length <= 1) return;
    setStack((s) => s.slice(0, -1));
  };

  const selectCurrent = () => {
    onSelect(current);
  };

  return (
    <div className="space-y-3">
      {/* breadcrumbs */}
      <div className="flex items-center gap-2 text-sm">
        {stack.map((f, idx) => (
          <span key={f.id} className="flex items-center gap-2">
            {idx > 0 && <span className="text-gray-400">/</span>}
            <button
              className={`underline ${idx === stack.length - 1 ? "decoration-2" : ""}`}
              onClick={() => setStack(stack.slice(0, idx + 1))}
            >
              {f.name}
            </button>
          </span>
        ))}
        {stack.length > 1 && (
          <button className="ml-auto text-xs underline text-blue-600" onClick={goUp}>Subir uma pasta</button>
        )}
      </div>

      {/* ações */}
      <div className="flex items-center gap-2">
        <input
          className="border rounded-lg px-3 py-2 text-sm w-full"
          placeholder="Filtrar por nome…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button
          className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
          onClick={() => load(current, null)}
          disabled={loading}
        >
          Atualizar
        </button>
        <button
          className="rounded-lg bg-purple-400 text-white px-3 py-2 text-sm hover:bg-purple-500"
          onClick={selectCurrent}
          disabled={loading}
          aria-label="Selecionar pasta atual"
        >
          Selecionar pasta
        </button>
      </div>

      {/* lista */}
      <div className="rounded-xl border">
        {loading && items.length === 0 ? (
          <div className="p-4 text-sm text-gray-500">Carregando…</div>
        ) : (
          <ul className="divide-y">
            {filtered.map((it) => (
              <li key={it.id} className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">
                    {isFolder(it) ? "📁" : "📄"}
                  </span>
                  <span className="text-sm">{it.name}</span>
                </div>
                {isFolder(it) ? (
                  <button
                    className="text-xs underline text-blue-600"
                    onClick={() => enterFolder(it)}
                  >
                    Abrir
                  </button>
                ) : (
                  <span className="text-xs text-gray-400">arquivo</span>
                )}
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-3 py-3 text-sm text-gray-500">Vazio</li>
            )}
          </ul>
        )}
        {/* paginação */}
        {nextPageToken && (
          <div className="p-3 flex justify-center">
            <button
              className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
              onClick={() => load(current, nextPageToken)}
              disabled={loading}
            >
              Carregar mais
            </button>
          </div>
        )}
      </div>
    </div>
  );
}