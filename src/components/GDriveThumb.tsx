import { useEffect, useMemo, useRef, useState } from "react";
import { useGDriveThumbs } from "@/hooks/useGDriveThumbs";

// Placeholder leve e garantido (ou troque por /img/placeholder.png SE existir)
const PLACEHOLDER = `data:image/svg+xml;utf8,` +
  encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='640' height='360'>
  <rect width='100%' height='100%' fill='#f1f5f9'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle'
  fill='#94a3b8' font-family='system-ui' font-size='16'>preview indisponível</text></svg>`);

type Props = {
  fileId: string;
  name: string;
  className?: string;
};

export default function GDriveThumb({ fileId, name, className }: Props) {
  // 1) Pega URL assinada atual; hook deve anexar cache-version (&cv=)
  const { urlFor, recoverOne } = useGDriveThumbs([fileId]);
  const currentUrl = useMemo(() => urlFor(fileId) || "", [fileId, urlFor]);

  // 2) Estado local da src (NUNCA manipular DOM direto em Promises)
  const [src, setSrc] = useState<string>(currentUrl || PLACEHOLDER);

  // 3) refs para evitar setState após unmount e limitar tentativas
  const mounted = useRef(true);
  const triedOnce = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // 4) quando o hook renovar a URL, atualize a src (com cache-buster)
  useEffect(() => {
    if (!currentUrl) return;
    setSrc(`${currentUrl}&v=${Date.now()}`);
  }, [currentUrl]);

  return (
    <img
      src={src}
      alt={name}
      loading="lazy"
      className={className ?? "h-36 w-full object-cover rounded-md bg-muted"}
      onError={async (e) => {
        // corta loop: este handler só roda no máximo 1x por componente
        if (triedOnce.current) {
          // garante parada em placeholder definitivo
          (e.currentTarget as HTMLImageElement).onerror = null;
          setSrc(PLACEHOLDER);
          return;
        }
        triedOnce.current = true;

        // cai em placeholder imediato para quebrar piscada/loop
        setSrc(PLACEHOLDER);

        // tenta renovar UMA vez a URL assinada
        try {
          await recoverOne(fileId);
          if (!mounted.current) return;
          const fresh = urlFor(fileId);
          if (fresh) setSrc(`${fresh}&v=${Date.now()}`);
          else setSrc(PLACEHOLDER);
        } catch {
          if (mounted.current) setSrc(PLACEHOLDER);
        }
      }}
    />
  );
}