import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface BackgroundSyncProgress {
  status: 'idle' | 'starting' | 'running' | 'error';
  processed: number;
  pending: number;
  error?: string;
  isCompleted?: boolean;
}

export function useDriveSyncBackground() {
  const [progress, setProgress] = useState<BackgroundSyncProgress>({
    status: 'idle',
    processed: 0,
    pending: 0
  });
  
  const pollIntervalRef = useRef<number | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const startBackgroundSync = useCallback(async () => {
    setProgress({ status: 'starting', processed: 0, pending: 0 });

    try {
      // 1. Start sync in background
      const { data, error } = await supabase.functions.invoke('drive-sync-background', {
        body: {}
      });

      if (error) throw error;

      if (data?.ok) {
        setProgress({ status: 'running', processed: 0, pending: 0 });
        
        // 2. Start polling to monitor progress
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
        
        pollIntervalRef.current = window.setInterval(async () => {
          const { data: user } = await supabase.auth.getUser();
          if (!user.user) return;

          const { data: state } = await supabase
            .from('drive_sync_state')
            .select('status, pending_folders, stats')
            .eq('user_id', user.user.id)
            .single();

          if (!state) return;

          const pending = Array.isArray(state.pending_folders) ? state.pending_folders.length : 0;
          const stats = state.stats as any;
          const processed = stats?.foldersProcessed || 0;
          const isCompleted = state.status === 'idle' && pending === 0 && stats?.completedAt;

          setProgress({
            status: state.status as 'idle' | 'running' | 'error',
            processed,
            pending,
            isCompleted
          });

          // Stop polling when completed or error
          if (state.status === 'error' || (state.status === 'idle' && pending === 0)) {
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            
            if (state.status === 'idle' && pending === 0) {
              toast.success('Sincronização em background concluída!', {
                description: `${processed} pastas processadas`
              });
              
              // Emit event for other components
              window.dispatchEvent(new CustomEvent('google-drive-status-changed'));
            } else {
              toast.error('Erro na sincronização em background', {
                description: 'Verifique os logs para mais detalhes'
              });
            }
          }
        }, 2000); // Poll every 2 seconds

        // Cleanup after 30 minutes
        setTimeout(() => {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        }, 30 * 60 * 1000);
      }

    } catch (err: any) {
      console.error('[background-sync] Failed to start:', err);
      toast.error('Não foi possível iniciar sincronização em background', {
        description: err.message
      });
      setProgress({ 
        status: 'error', 
        processed: 0, 
        pending: 0, 
        error: err.message 
      });
    }
  }, []);

  const reset = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setProgress({
      status: 'idle',
      processed: 0,
      pending: 0
    });
  }, []);

  return {
    progress,
    startBackgroundSync,
    reset
  };
}
