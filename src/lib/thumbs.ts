import { supabase } from "@/integrations/supabase/client";

export async function fetchSignedThumbUrls(fileIds: string[]): Promise<Record<string, string>> {
  if (!fileIds?.length) return {};
  const { data, error } = await supabase.functions.invoke("get-thumb-urls", { body: { fileIds } });
  if (error) throw error;
  return data?.urls ?? {};
}

/**
 * Fetches thumbnail URL for a single item from drive-thumb-fetch
 * @param itemId - The item ID (with or without gdrive: prefix)
 * @param size - Thumbnail size (default: 256)
 * @returns Thumbnail URL or null if failed
 */
export async function fetchThumbUrl(itemId: string, size = 256): Promise<string | null> {
  try {
    const cleanId = String(itemId).replace(/^gdrive:/, "");
    const { data, error } = await supabase.functions.invoke("drive-thumb-fetch", {
      body: { itemId: cleanId, size }
    });

    if (error) {
      console.error('Failed to fetch thumb:', error);
      return null;
    }

    if (!data?.ok || !data?.url) {
      console.error('Invalid thumb response:', data);
      return null;
    }

    return data.url;
  } catch (err) {
    console.error('Error fetching thumb:', err);
    return null;
  }
}