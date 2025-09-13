import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type DriveItem = { id: string; name: string; mimeType?: string };
type Folder = { id: string; name: string };

export default function FolderBrowserCard({
  open,
  onClose,
  onPicked,
}: {
  open: boolean;
  onClose: () => void;
  onPicked: (folder: Folder) => void;
}) {
  const [stack, setStack] = useState<Folder[]>([{ id: "root", name: "Meu Drive" }]);
  const [items, setItems] = useState<DriveItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);

  const current = stack[stack.length - 1];
  const isFolder = (it: DriveItem) => it.mimeType === "application/vnd.google-apps.folder";

  const filtered = useMemo(() => {
    if (!filter) return items;
    const q = filter.toLowerCase();
    return items.filter((it) => (it.name || "").toLowerCase().includes(q));
  }, [filter, items]);

  const authHeaders = useCallback(async () => {
    // ✅ Passar JWT explicitamente evita 401 nas Edge Functions com verify_jwt
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const load = useCallback(async (folder: Folder, pageToken?: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      let resp;
      if (folder.id === "root") {
        resp = await supabase.functions.invoke("diag-list-root", {
          headers,
          body: pageToken ? { pageToken } : {},
        });
      } else {
        resp = await supabase.functions.invoke("diag-list-folder", {
          headers,
          body: pageToken ? { folderId: folder.id, pageToken } : { folderId: folder.id },
        });
      }
      if (resp.error) throw resp.error;

      const data = resp.data || {};
      const newItems: DriveItem[] = data.files || data.items || [];
      const token: string | null = data.nextPageToken || null;

      setItems((prev) => (pageToken ? prev.concat(newItems) : newItems));
      setNextPageToken(token);
    } catch (e: any) {
      console.error("Drive list error:", e);
      setError(e?.message || "LIST_FAILED");
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    if (open) load(current, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, current.id]);

  const enterFolder = async (it: DriveItem) => {
    if (!isFolder(it) || busyRef.current) return;
    busyRef.current = true;
    try {
      setStack((s) => [...s, { id: it.id, name: it.name || "Pasta" }]);
      // o useEffect carregará a nova pasta
    } finally {
      setTimeout(() => (busyRef.current = false), 250);
    }
  };

  const goUp = () => {
    if (stack.length <= 1) return;
    setStack((s) => s.slice(0, -1));
  };

  const selectCurrent = () => onPicked(current);

  if (!open) return null;

  return (
    <div className="mt-3 rounded-2xl border p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm flex-wrap">
          {stack.map((f, i) => (
            <span key={f.id} className="flex items-center gap-2">
              {i > 0 && <span className="text-gray-400">/</span>}
              <button
                className={`underline ${i === stack.length - 1 ? "decoration-2" : ""}`}
                onClick={() => setStack(stack.slice(0, i + 1))}
              >
                {f.name}
              </button>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {stack.length > 1 && (
            <button className="text-xs underline text-blue-600" onClick={goUp}>Subir</button>
          )}
          <button
            className="rounded-lg bg-blue-600 text-white px-3 py-1.5 text-xs hover:bg-blue-700"
            onClick={selectCurrent}
          >
            Selecionar esta pasta
          </button>
          <button className="text-xs text-gray-500 hover:underline" onClick={onClose}>Fechar</button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-2">
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
      </div>

      {error && <div className="mb-2 text-sm text-red-600">Erro: {error}</div>}

      <div className="rounded-xl border">
        {loading && items.length === 0 ? (
          <div className="p-4 text-sm text-gray-500">Carregando…</div>
        ) : (
          <ul className="divide-y">
            {filtered.map((it) => (
              <li key={it.id} className="px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>{isFolder(it) ? "📁" : "📄"}</span>
                  <span className="text-sm">{it.name}</span>
                </div>
                {isFolder(it) ? (
                  <button className="text-xs underline text-blue-600" onClick={() => enterFolder(it)}>Abrir</button>
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