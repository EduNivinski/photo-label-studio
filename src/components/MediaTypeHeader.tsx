import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Image, Video } from "lucide-react";

type MediaKind = "photo" | "video" | null | undefined;

interface MediaTypeHeaderProps {
  mediaKind?: MediaKind;
  mimeType?: string;
  originalTakenAt?: string | null;
  createdAt?: string | null;
  className?: string;
}

export function MediaTypeHeader({
  mediaKind,
  mimeType,
  originalTakenAt,
  createdAt,
  className = "",
}: MediaTypeHeaderProps) {
  // Determinar o tipo
  const kind = 
    mediaKind === "video" ? "video" :
    mediaKind === "photo" ? "photo" :
    mimeType?.startsWith("video/") ? "video" :
    mimeType?.startsWith("image/") ? "photo" :
    undefined;

  const kindLabel = kind === "video" ? "Vídeo" : kind === "photo" ? "Foto" : "Arquivo";
  const Icon = kind === "video" ? Video : Image;

  // Extrair formato do mime_type (ex: image/jpeg -> JPEG, video/mp4 -> MP4)
  const fileFormat = mimeType 
    ? mimeType.split('/')[1]?.toUpperCase().replace('JPEG', 'JPG')
    : null;

  // Usar original_taken_at se disponível, senão fallback para created_at
  const dateToDisplay = originalTakenAt || createdAt;
  const dateLabel = dateToDisplay
    ? format(new Date(dateToDisplay), "dd/MM/yyyy · HH:mm", { locale: ptBR })
    : "—";

  return (
    <div
      className={`flex items-center justify-between text-lg text-muted-foreground py-1 ${className}`}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5" />
        <span className="font-medium">{kindLabel}</span>
        {fileFormat && (
          <>
            <span className="text-muted-foreground/50">·</span>
            <span className="text-sm">{fileFormat}</span>
          </>
        )}
      </div>
      <span>{dateLabel}</span>
    </div>
  );
}
