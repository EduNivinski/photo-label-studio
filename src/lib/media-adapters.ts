import { MediaItem } from "@/types/media";

export function fromDB(row: any): MediaItem {
  return {
    id: `db:${row.id}`,
    source: "db",
    name: row.name,
    mimeType: row.media_type === 'video' ? 'video/mp4' : 'image/jpeg', // adaptação do campo media_type
    isVideo: row.media_type === 'video',
    width: row.width ?? null,
    height: row.height ?? null,
    durationMs: row.duration_ms ?? null,
    createdAt: row.upload_date || row.created_at,
    updatedAt: row.updated_at,
    posterUrl: row.url, // já pública do storage
    previewUrl: row.url,
    openInDriveUrl: null,
    downloadEnabled: true,
    labels: (row.labels || []).map((labelName: string) => ({ 
      id: labelName, 
      name: labelName 
    })),
  };
}

export function fromGDrive(row: any, thumbUrl?: string | null, downloadsEnabled?: boolean): MediaItem {
  const isVideo = (row.mime_type || row.mimeType || "").startsWith("video/");
  return {
    id: `gdrive:${row.item_key || row.file_id || row.id}`,
    source: "gdrive",
    name: row.name,
    mimeType: row.mime_type || row.mimeType,
    isVideo,
    width: row.video_width ?? row.width ?? null,
    height: row.video_height ?? row.height ?? null,
    durationMs: row.video_duration_ms ?? null,
    createdAt: row.created_time || row.created_at || null,
    updatedAt: row.modified_time || row.updated_at || null,
    mediaKind: row.media_kind ?? null,
    originalTakenAt: row.original_taken_at ?? null,
    posterUrl: thumbUrl || row.thumbnail_link || null,
    previewUrl: null,
    openInDriveUrl: row.web_view_link || `https://drive.google.com/file/d/${row.item_key || row.file_id || row.id}/view`,
    downloadEnabled: !!downloadsEnabled,
    labels: row.labels || [],
  };
}

export function extractSourceAndKey(mediaId: string): { source: "db" | "gdrive", key: string } {
  const [source, key] = mediaId.split(':', 2);
  return { 
    source: source as "db" | "gdrive", 
    key 
  };
}