import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DriveGlobalSyncStatus {
  status: 'idle' | 'running' | 'error';
  processed: number;
  pending: number;
  isCompleted?: boolean;
  isActive: boolean;
}

export function useDriveSyncStatus() {
  const [syncStatus, setSyncStatus] = useState<DriveGlobalSyncStatus>({
    status: 'idle',
    processed: 0,
    pending: 0,
    isActive: false
  });
  
  const pollIntervalRef = useRef<number | null>(null);

  const checkSyncStatus = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { data: state, error } = await supabase
        .from('drive_sync_state')
        .select('status, pending_folders, stats')
        .eq('user_id', user.user.id)
        .single();

      if (error || !state) {
        // No sync state found, user probably hasn't synced yet
        setSyncStatus({
          status: 'idle',
          processed: 0,
          pending: 0,
          isActive: false
        });
        return;
      }

      const pending = Array.isArray(state.pending_folders) ? state.pending_folders.length : 0;
      const stats = state.stats as any;
      const processed = stats?.foldersProcessed || 0;
      const isCompleted = state.status === 'idle' && pending === 0 && stats?.completedAt;
      const isActive = state.status === 'running' && pending > 0;

      setSyncStatus({
        status: state.status as 'idle' | 'running' | 'error',
        processed,
        pending,
        isCompleted,
        isActive
      });

      // Start/stop polling based on status
      if (isActive && !pollIntervalRef.current) {
        // Start polling if sync is active
        pollIntervalRef.current = window.setInterval(checkSyncStatus, 3000);
      } else if (!isActive && pollIntervalRef.current) {
        // Stop polling if sync is not active
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }

    } catch (err) {
      console.error('[useDriveSyncStatus] Error checking status:', err);
    }
  };

  useEffect(() => {
    // Initial check
    checkSyncStatus();

    // Listen for sync events
    const handleSyncEvent = () => {
      checkSyncStatus();
    };
    
    window.addEventListener('google-drive-status-changed', handleSyncEvent);

    // Cleanup
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      window.removeEventListener('google-drive-status-changed', handleSyncEvent);
    };
  }, []);

  return syncStatus;
}
