import { useEffect, useMemo, useRef, useState } from "react";
import { fetchSignedThumbUrls } from "@/lib/thumbs";

type Options = { refreshMs?: number }; // default ~4 min (antes do expirar de 5 min)
const DEFAULT_REFRESH = 4 * 60 * 1000;

export function useGDriveThumbs(fileIds: string[], opts: Options = {}) {
  const ids = useMemo(() => Array.from(new Set(fileIds.filter(Boolean))), [fileIds]);
  const [map, setMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const refreshMs = opts.refreshMs ?? DEFAULT_REFRESH;
  const timer = useRef<number | null>(null);

  async function refresh(requestIds = ids) {
    if (!requestIds.length) return;
    setLoading(true);
    try {
      const urls = await fetchSignedThumbUrls(requestIds);
      setMap((prev) => ({ ...prev, ...urls }));
    } finally {
      setLoading(false);
    }
  }

  // primeira carga
  useEffect(() => { refresh(ids); /* no-op if empty */ }, [ids.join("|")]);

  // renovação periódica (antes do expirar)
  useEffect(() => {
    if (timer.current) window.clearInterval(timer.current);
    if (!ids.length) return;
    timer.current = window.setInterval(() => refresh(ids), refreshMs) as unknown as number;
    return () => { if (timer.current) window.clearInterval(timer.current); };
  }, [ids.join("|"), refreshMs]);

  // recuperar um id específico (ex.: onError do <img>)
  async function recoverOne(fileId: string) {
    if (!fileId) return;
    await refresh([fileId]);
  }

  return { urlFor: (id: string) => map[id] || "", map, loading, refresh, recoverOne };
}