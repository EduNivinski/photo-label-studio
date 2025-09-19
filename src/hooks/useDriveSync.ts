import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface DriveChanges {
  newCount: number;
  additions: number;
  modifications: number;
  removals: number;
}

export const useDriveSync = () => {
  const [changes, setChanges] = useState<DriveChanges | null>(null);
  const [loading, setLoading] = useState(false);
  
  const checkChanges = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke("drive-changes-peek");
      if (data && !error) {
        setChanges({
          newCount: data.newCount || 0,
          additions: data.additions || 0,
          modifications: data.modifications || 0,
          removals: data.removals || 0,
        });
      }
    } catch (e) {
      console.warn("Failed to check Drive changes:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const syncNow = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke("drive-changes-pull");
      if (data && !error) {
        setChanges(null); // Reset changes after sync
        // Dispatch event to refresh data
        window.dispatchEvent(new CustomEvent('google-drive-status-changed'));
        return { success: true, processed: data.processed };
      }
      return { success: false, error: error?.message };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Sync failed" };
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Listen for Drive status changes
    const handleStatusChange = () => {
      setTimeout(checkChanges, 1000); // Delay to allow sync to complete
    };
    
    window.addEventListener('google-drive-status-changed', handleStatusChange);
    return () => window.removeEventListener('google-drive-status-changed', handleStatusChange);
  }, [checkChanges]);

  return {
    changes,
    loading,
    checkChanges,
    syncNow,
    hasNewChanges: (changes?.newCount ?? 0) > 0,
  };
};