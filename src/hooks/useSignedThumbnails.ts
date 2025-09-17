import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useSignedThumbnails = (fileIds: string[]) => {
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fileIds || fileIds.length === 0) {
      setThumbnailUrls({});
      return;
    }

    const fetchSignedUrls = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const { data, error } = await supabase.functions.invoke("get-thumb-urls", {
          body: { fileIds }
        });

        if (error) {
          throw new Error(error.message);
        }

        if (data?.ok && data?.urls) {
          setThumbnailUrls(data.urls);
        } else {
          throw new Error(data?.reason || "Failed to get signed URLs");
        }
      } catch (err) {
        console.error("Error fetching signed thumbnail URLs:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
        setThumbnailUrls({});
      } finally {
        setIsLoading(false);
      }
    };

    fetchSignedUrls();
  }, [fileIds.join(",")]);

  return { thumbnailUrls, isLoading, error };
};