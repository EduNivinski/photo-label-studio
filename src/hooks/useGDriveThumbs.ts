import { useEffect, useMemo, useRef, useState } from "react";
import { fetchSignedThumbUrls } from "@/lib/thumbs";

type Options = { refreshMs?: number }; // default ~4 min (antes do expirar de 5 min)
const DEFAULT_REFRESH = 4 * 60 * 1000;

export function useGDriveThumbs(fileIds: string[], opts: Options = {}) {
  const ids = useMemo(() => Array.from(new Set(fileIds.filter(Boolean))), [fileIds]);
  const [map, setMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [vers, setVers] = useState<Record<string, number>>({});
  const refreshMs = opts.refreshMs ?? DEFAULT_REFRESH;
  const inflight = useRef(new Set<string>());
  const timer = useRef<number | null>(null);

  async function refresh(requestIds = ids) {
    const pending = requestIds.filter(id => !inflight.current.has(id));
    if (!pending.length) return;
    
    pending.forEach(id => inflight.current.add(id));
    setLoading(true);
    try {
      const urls = await fetchSignedThumbUrls(pending);
      setMap((prev) => ({ ...prev, ...urls }));
      // bump version para forçar recarregar
      setVers(prev => {
        const next = { ...prev };
        pending.forEach(id => { next[id] = (next[id] || 0) + 1; });
        return next;
      });
    } finally {
      pending.forEach(id => inflight.current.delete(id));
      setLoading(false);
    }
  }

  // primeira carga
  useEffect(() => { 
    if (ids.length) refresh(ids);
  }, [ids.join("|")]);

  // renovação periódica com setTimeout
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!ids.length) return;
    
    const tick = async () => {
      await refresh(ids);
      timer.current = window.setTimeout(tick, refreshMs) as unknown as number;
    };
    
    timer.current = window.setTimeout(tick, refreshMs) as unknown as number;
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [ids.join("|"), refreshMs]);

  // recuperar um id específico (ex.: onError do <img>)
  async function recoverOne(fileId: string) {
    if (!fileId) return;
    await refresh([fileId]);
  }

  function urlFor(id: string) {
    const u = map[id] || "";
    const v = vers[id] || 0;
    return u ? `${u}&cv=${v}` : "";
  }

  return { urlFor, map, loading, refresh, recoverOne };
}