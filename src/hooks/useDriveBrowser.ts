import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useDriveBrowser() {
  const [stack, setStack] = useState<string[]>(["root"]); // pilha de folderIds
  const [items, setItems] = useState<any[]>([]);
  const [next, setNext] = useState<string|null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string|null>(null);

  const current = stack[stack.length - 1];

  const list = useCallback(async (reset = true) => {
    setLoading(true); setErr(null);
    try {
      const tok = (await supabase.auth.getSession()).data.session?.access_token;
      const url = current === "root"
        ? "/functions/v1/diag-list-root"
        : "/functions/v1/diag-list-folder";

      const body = current === "root"
        ? (next && !reset ? { pageToken: next } : {})
        : ({ folderId: current, ...(next && !reset ? { pageToken: next } : {}) });

      const r = await fetch(`https://tcupxcxyylxfgsbhfdhw.supabase.co${url}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const txt = await r.text();
      const data = (() => { try { return JSON.parse(txt); } catch { return {}; } })();

      if (r.status === 401) {
        setErr(data?.reason || "UNAUTHORIZED");
        setItems([]); setNext(null);
        return;
      }
      if (!r.ok || !data?.ok) {
        setErr(data?.reason || "LIST_FAILED");
        setItems([]); setNext(null);
        return;
      }

      const folders = (data.files || []).filter((f: any) => f.mimeType === "application/vnd.google-apps.folder");
      setItems(reset ? folders : [...items, ...folders]);
      setNext(data.nextPageToken ?? null);
    } finally {
      setLoading(false);
    }
  }, [current, next, items]);

  const enter = useCallback((folderId: string) => {
    setStack((s) => [...s, folderId]);
    setNext(null);
  }, []);

  const back = useCallback(() => {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
    setNext(null);
  }, []);

  const selectHere = useCallback(async (folderId: string, folderName?: string) => {
    const tok = (await supabase.auth.getSession()).data.session?.access_token;
    const r = await fetch(`https://tcupxcxyylxfgsbhfdhw.supabase.co/functions/v1/google-drive-auth`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "setFolder", folderId, folderName }),
    });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`setFolder failed: ${t}`);
    }
  }, []);

  return { current, items, next, loading, err, list, enter, back, selectHere };
}