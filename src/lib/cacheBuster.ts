/**
 * Adds cache-busting query parameter to URLs, but skips data: and blob: URLs
 */
export function withCacheBuster(url: string | null | undefined): string {
  if (!url) return "";
  
  // Don't modify data URLs or blob URLs
  if (url.startsWith("data:") || url.startsWith("blob:")) {
    return url;
  }

  // Add cache-buster with proper separator
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}cb=${Date.now()}`;
}
