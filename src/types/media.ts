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
  
  // collections and origin
  driveOriginFolder?: string | null; // Pasta de origem do Drive
  collections?: string[]; // Collections criadas manualmente
}

export interface MediaListResponse {
  items: MediaItem[];
  total: number;
  totalPhotos?: number;
  totalVideos?: number;
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
  collectionId?: string; // Collection manual (UUID)
  driveOriginFolder?: string; // Pasta de origem do Drive
  originStatus?: "active" | "missing" | "permanently_deleted"; // Status de órfãos
}