export type MediaSource = "db" | "gdrive";

export interface MediaItem {
  id: string;                 // chave canônica p/ front
  source: MediaSource;        // "db" | "gdrive"
  name: string;
  mimeType: string;
  isVideo: boolean;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null; // vídeos
  createdAt?: string;         // ISO
  updatedAt?: string;         // ISO
  
  // Tipo de mídia e data original
  mediaKind?: 'photo' | 'video' | null;
  originalTakenAt?: string | null;  // Data original de captura (EXIF/metadata)

  // visual
  posterUrl?: string | null;  // URL (thumb) pronta p/ <img>, sem Header (assinada p/ gdrive)
  previewUrl?: string | null; // opcional/p futuro

  // ações
  openInDriveUrl?: string | null; // só quando source=gdrive
  downloadEnabled?: boolean; // toggle opt-in drive.readonly

  // labels
  labels: Array<{ id: string; name: string; color?: string }>;
}

export interface MediaListResponse {
  items: MediaItem[];
  total: number;
  page: number;
  pageSize: number;
  debugFilledThumbs?: number;
  /** Indica que o token do Drive não tem escopo de conteúdo (requer reconsent) */
  needsDriveReauth?: boolean;
}

export interface MediaListRequest {
  page: number;
  pageSize: number;
  source?: "all" | "db" | "gdrive";
  mimeClass?: "all" | "image" | "video";
  labelIds?: string[];
  q?: string; // busca por nome
}