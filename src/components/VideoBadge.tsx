import { formatDuration } from "@/lib/formatDuration";

interface VideoBadgeProps {
  ms?: number | null;
}

export default function VideoBadge({ ms }: VideoBadgeProps) {
  const d = formatDuration(ms);
  if (!d || d === "00:00") return null;
  return (
    <span className="absolute bottom-2 right-2 rounded bg-black/70 text-white text-xs px-1.5 py-0.5">
      {d}
    </span>
  );
}