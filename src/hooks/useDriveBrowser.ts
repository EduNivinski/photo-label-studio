import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type DriveItem = { id: string; name: string; mimeType: string; trashed?: boolean };

type ListFn = (folderId: string) => Promise<{ ok: boolean; items: DriveItem[]; error?: any }>;

// função que chama a edge function
async function listFolderViaEdge(folderId: string) {
  const fn = folderId === "root" ? "diag-list-root" : "diag-list-folder";
  const payload = folderId === "root" ? undefined : { body: { folderId } };
  const r = await supabase.functions.invoke(fn, payload as any);
  if (r.error) return { ok: false, items: [], error: r.error };
  const rows: DriveItem[] = (r.data?.files || []).filter((it: any) => it && it.name);
  return { ok: true, items: rows };
}

export function useDriveBrowser(listFolder: ListFn = listFolderViaEdge) {
  // Breadcrumb: cada elemento é { id, name }
  const [path, setPath] = useState<{ id: string; name: string }[]>([{ id: "root", name: "Meu Drive" }]);
  const [items, setItems] = useState<DriveItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = path[path.length - 1];
  const canGoBack = path.length > 1;

  const load = useCallback(async (folderId: string) => {
    setLoading(true); 
    setError(null);
    try {
      const r = await listFolder(folderId);
      if (!r.ok) throw new Error(r.error?.message || "LIST_FAILED");
      setItems(r.items || []);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [listFolder]);

  // inicial: root
  useEffect(() => { 
    load("root"); 
    // eslint-disable-next-line 
  }, []);

  const openFolder = useCallback(async (id: string, name: string) => {
    // empilha no breadcrumb
    setPath(p => [...p, { id, name }]);
    await load(id);
  }, [load]);

  const goBack = useCallback(async () => {
    if (path.length > 1) {
      const newPath = path.slice(0, -1);
      setPath(newPath);
      await load(newPath[newPath.length - 1].id);
    }
  }, [path, load]);

  const goToCrumb = useCallback(async (index: number) => {
    const newPath = path.slice(0, index + 1);
    setPath(newPath);
    await load(newPath[newPath.length - 1].id);
  }, [path, load]);

  return { 
    path, 
    current, 
    items, 
    loading, 
    error, 
    canGoBack, 
    openFolder, 
    goBack, 
    goToCrumb 
  };
}