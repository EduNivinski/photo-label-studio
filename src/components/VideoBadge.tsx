export function fmtDuration(ms?: number | null) {
  if (!ms || ms <= 0) return null;
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = (s % 60).toString().padStart(2, "0");
  return h > 0 ? `${h}:${m.toString().padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

interface VideoBadgeProps {
  ms?: number | null;
}

export default function VideoBadge({ ms }: VideoBadgeProps) {
  const d = fmtDuration(ms);
  if (!d) return null;
  return (
    <span className="absolute bottom-2 right-2 rounded bg-black/70 text-white text-xs px-1.5 py-0.5">
      {d}
    </span>
  );
}