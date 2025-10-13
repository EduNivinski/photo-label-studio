import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SyncProgress {
  phase: 'idle' | 'indexing' | 'syncing' | 'complete' | 'error';
  message: string;
  processedFolders?: number;
  queuedFolders?: number;
  updatedItems?: number;
}

export function useDriveSyncOrchestrator() {
  const [progress, setProgress] = useState<SyncProgress>({ phase: 'idle', message: '' });
  const { toast } = useToast();

  const getAuthHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }
    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    };
  }, []);

  const runFullSync = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();

      // Step 1: Arm sync with latest folder from DB (auto-heals if mismatch)
      setProgress({ phase: 'indexing', message: 'Preparando sincronização...' });
      
      const { data: startData, error: startError } = await supabase.functions.invoke('drive-sync-start', {
        headers,
      });

      if (startError || !startData?.ok) {
        const errorMsg = startData?.error || startError?.message || "Erro ao iniciar sincronização";
        throw new Error(errorMsg);
      }

      console.log('[ORCHESTRATOR] Sync armed with root:', startData.effectiveRootFolderId);

      // Step 2: Index folder (seed drive_sync_state with files)
      setProgress({ phase: 'indexing', message: 'Indexando pasta...' });

      const { data: indexData, error: indexError } = await supabase.functions.invoke('drive-index-folder', {
        headers,
      });

      if (indexError || !indexData?.ok) {
        const errorMsg = indexData?.error || indexError?.message || "Erro ao indexar pasta";
        throw new Error(errorMsg);
      }

      setProgress({ 
        phase: 'syncing', 
        message: `Sincronizando arquivos...`,
        updatedItems: indexData.totalFiles || 0,
        queuedFolders: indexData.totalFolders || 0
      });

      // Step 3: Run sync loop until pending queue is empty
      let done = false;
      let totalProcessed = 0;
      let totalItems = 0;
      const MAX_ITERATIONS = 50; // Safety limit
      let iterations = 0;

      while (!done && iterations < MAX_ITERATIONS) {
        iterations++;
        const { data: syncData, error: syncError } = await supabase.functions.invoke('drive-sync-run', {
          body: { budgetFolders: 10 },
          headers,
        });

        if (syncError || !syncData?.ok) {
          console.error('[ORCHESTRATOR] Sync run failed:', syncError || syncData);
          // Don't throw - we may have partial progress
          break;
        }

        done = syncData.done || false;
        totalProcessed += syncData.processedFolders || 0;
        totalItems += syncData.updatedItems || 0;

        setProgress({ 
          phase: 'syncing', 
          message: `Processando... ${totalItems} arquivos encontrados`,
          processedFolders: totalProcessed,
          queuedFolders: syncData.queued || 0,
          updatedItems: totalItems
        });

        // Small delay to avoid rate limits
        if (!done) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Step 4: Run delta sync (changes-pull)
      const { data: deltaData, error: deltaError } = await supabase.functions.invoke('drive-changes-pull', {
        headers,
      });

      if (!deltaError && deltaData?.ok) {
        console.log('[ORCHESTRATOR] Delta sync completed:', deltaData);
      }

      setProgress({ 
        phase: 'complete', 
        message: `Sincronização completa! ${totalItems} arquivos indexados`,
        updatedItems: totalItems,
        processedFolders: totalProcessed
      });

      toast({
        title: "Sincronização completa",
        description: `${totalItems} arquivos indexados com sucesso`,
      });

      // Trigger refresh event
      window.dispatchEvent(new CustomEvent('google-drive-status-changed'));

      return { success: true, totalItems, totalProcessed };

    } catch (error: any) {
      console.error('[ORCHESTRATOR] Error:', error);
      
      const errorMessage = error?.message || 'Erro desconhecido';
      const hint = error?.hint || '';
      
      setProgress({ 
        phase: 'error', 
        message: `${errorMessage}${hint ? '. ' + hint : ''}` 
      });

      toast({
        variant: 'destructive',
        title: "Erro na sincronização",
        description: `${errorMessage}${hint ? '. ' + hint : ''}`,
      });

      return { success: false, error: errorMessage };
    }
  }, [getAuthHeaders, toast]);

  const reset = useCallback(() => {
    setProgress({ phase: 'idle', message: '' });
  }, []);

  return {
    progress,
    runFullSync,
    reset,
  };
}
