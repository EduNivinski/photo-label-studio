import { SUPABASE_URL } from "@/integrations/supabase/client";

/**
 * Get the thumbnail URL for a Google Drive file
 * @param fileId - The Google Drive file ID
 * @returns The thumbnail proxy URL
 */
export const getDriveThumbnailUrl = (fileId: string): string => {
  const encodedFileId = encodeURIComponent(fileId);
  return `${SUPABASE_URL}/functions/v1/drive-thumb?fileId=${encodedFileId}`;
};

/**
 * Check if a URL appears to be a Google Drive URL
 * @param url - The URL to check
 * @returns True if the URL appears to be from Google Drive
 */
export const isDriveUrl = (url: string): boolean => {
  return url.includes('drive.google.com') || url.includes('googleusercontent.com');
};

/**
 * Extract file ID from a Google Drive URL
 * @param url - The Google Drive URL
 * @returns The file ID or null if not found
 */
export const extractDriveFileId = (url: string): string | null => {
  // Handle different Google Drive URL formats
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9-_]+)/,
    /id=([a-zA-Z0-9-_]+)/,
    /\/([a-zA-Z0-9-_]+)\/view/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
};

/**
 * Get the appropriate thumbnail URL for an item
 * @param item - Object with source, item_key, and optional thumbnail_link
 * @returns The thumbnail URL (proxy for Drive items, original for others)
 */
export const getThumbnailUrl = (item: {
  source?: string;
  item_key?: string;
  thumbnail_link?: string;
  url?: string;
}): string => {
  // If explicitly marked as Google Drive source
  if (item.source === "gdrive" && item.item_key) {
    return getDriveThumbnailUrl(item.item_key);
  }
  
  // If URL looks like a Drive URL, try to extract file ID and use proxy
  if (item.url && isDriveUrl(item.url)) {
    const fileId = extractDriveFileId(item.url);
    if (fileId) {
      return getDriveThumbnailUrl(fileId);
    }
  }
  
  // Fall back to original thumbnail or URL
  return item.thumbnail_link || item.url || '';
};

/**
 * Create an image element with fallback handling for Drive thumbnails
 * @param src - The thumbnail URL
 * @param fallbackSrc - Optional fallback URL
 * @param onError - Optional error handler
 * @returns Object with src and error handler
 */
export const createThumbnailProps = (
  src: string,
  fallbackSrc?: string,
  onError?: () => void
) => {
  return {
    src,
    onError: (e: React.SyntheticEvent<HTMLImageElement>) => {
      const target = e.target as HTMLImageElement;
      
      // If there's a fallback and we haven't used it yet
      if (fallbackSrc && target.src !== fallbackSrc) {
        target.src = fallbackSrc;
        return;
      }
      
      // Call custom error handler if provided
      onError?.();
    }
  };
};