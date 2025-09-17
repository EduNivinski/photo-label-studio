import { supabase } from "@/integrations/supabase/client";

export async function fetchSignedThumbUrls(fileIds: string[]): Promise<Record<string, string>> {
  if (!fileIds?.length) return {};
  const { data, error } = await supabase.functions.invoke("get-thumb-urls", { body: { fileIds } });
  if (error) throw error;
  return data?.urls ?? {};
}