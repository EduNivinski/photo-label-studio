import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface DrivePhotoCardProps {
  fileId: string;
  name: string;
  className?: string;
}

export function DrivePhotoCard({ fileId, name, className }: DrivePhotoCardProps) {
  const [url, setUrl] = useState("");
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    let live = true;
    
    const loadUrl = async () => {
      try {
        const r = await supabase.functions.invoke("get-thumb-urls", { 
          body: { fileIds: [fileId] }
        });
        
        if (r.error) {
          console.error('Error fetching thumbnail URL:', r.error);
          return;
        }
        
        const u = Object.values<string>(r.data?.urls || {})[0] || "";
        if (live) setUrl(u);
      } catch (error) {
        console.error('Failed to load thumbnail URL:', error);
      }
    };

    loadUrl();
    
    return () => { 
      live = false; 
    };
  }, [fileId]);

  const onError = async () => {
    if (attempts >= 1) return; // máximo 1 retry
    
    setAttempts(a => a + 1);
    
    try {
      const r = await supabase.functions.invoke("get-thumb-urls", { 
        body: { fileIds: [fileId] }
      });
      const u = Object.values<string>(r.data?.urls || {})[0] || "";
      setUrl(u);
    } catch (error) {
      console.error('Failed to retry thumbnail URL:', error);
    }
  };

  // skeleton enquanto carrega
  if (!url) {
    return (
      <div className={className || "h-40 w-40 bg-muted/60 animate-pulse rounded-lg"} />
    );
  }

  return (
    <img
      src={url}
      alt={name}
      loading="lazy"
      onError={onError}
      className={className || "h-40 w-40 object-cover rounded-lg bg-muted/40"}
    />
  );
}