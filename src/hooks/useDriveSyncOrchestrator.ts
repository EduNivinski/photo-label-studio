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

  const runFullSync = useCallback(async (folderId: string, folderName: string, folderPath?: string) => {
    try {
      const headers = await getAuthHeaders();
      const traceId = crypto.randomUUID();
      console.log('[ORCHESTRATOR] Starting full sync:', { traceId, folderId, folderName });

      // Step 1: Align root state with current settings (drive-sync-start)
      setProgress({ phase: 'indexing', message: 'Preparando sincronização...' });
      console.log('[ORCHESTRATOR][start] Calling drive-sync-start to align root...');
      
      const { data: startData, error: startError } = await supabase.functions.invoke('drive-sync-start', {
        headers,
      });
      
      if (startError || !startData?.ok) {
        const errorMsg = startData?.error || startError?.message || 'Erro ao preparar sincronização';
        console.error('[ORCHESTRATOR][start] Failed:', errorMsg);
        throw new Error(errorMsg);
      }

      console.log('[ORCHESTRATOR][start] OK:', startData);

      // Step 2: Validate that root_folder_id matches folderId
      const { data: diagData, error: diagError } = await supabase.functions.invoke('drive-sync-diagnostics', {
        headers: { ...headers, 'Cache-Control': 'no-store' },
      });

      if (diagError || !diagData?.ok) {
        console.error('[ORCHESTRATOR][diag] Failed to get diagnostics:', diagError);
        throw new Error('Falha ao validar estado de sincronização');
      }

      const currentRoot = diagData.state?.rootFolderId;
      console.log('[ORCHESTRATOR][diag] Root validation:', { expected: folderId, actual: currentRoot });

      if (currentRoot !== folderId) {
        console.error('[ORCHESTRATOR][diag] ROOT_MISMATCH detected!', { expected: folderId, actual: currentRoot });
        throw new Error(`Pasta configurada não corresponde ao estado de sincronização (esperado: ${folderId}, atual: ${currentRoot || 'null'})`);
      }

      setProgress({ phase: 'indexing', message: 'Indexando pasta...' });

      // Step 3: Check if indexing is needed (pending === 0)
      const needsIndex = !diagData.state?.pending || diagData.state.pending.length === 0;
      
      if (needsIndex) {
        console.log('[ORCHESTRATOR][index] First sync for this folder, indexing...');
        const { data: indexData, error: indexError } = await supabase.functions.invoke('drive-index-folder', {
          headers,
        });

        if (indexError || !indexData?.ok) {
          const errorMsg = indexData?.error || indexError?.message || "Erro ao indexar pasta";
          console.error('[ORCHESTRATOR][index] Failed:', errorMsg);
          throw new Error(errorMsg);
        }

        console.log('[ORCHESTRATOR][index] OK:', indexData);
        setProgress({ 
          phase: 'syncing', 
          message: `Sincronizando arquivos...`,
          updatedItems: indexData.totalFiles || 0,
          queuedFolders: indexData.totalFolders || 0
        });
      } else {
        console.log('[ORCHESTRATOR][index] Skipping index, pending folders already exist');
        setProgress({ 
          phase: 'syncing', 
          message: `Processando pastas pendentes...`,
          queuedFolders: diagData.state.pending.length
        });
      }

      // Step 4: Run sync loop until pending queue is empty
      let done = false;
      let totalProcessed = 0;
      let totalItems = 0;
      const MAX_ITERATIONS = 50; // Safety limit
      let iterations = 0;
      let rearmRetries = 0;
      const MAX_REARM_RETRIES = 3;

      while (!done && iterations < MAX_ITERATIONS) {
        iterations++;
        console.log(`[ORCHESTRATOR][run] Iteration ${iterations}...`);
        
        const { data: syncData, error: syncError } = await supabase.functions.invoke('drive-sync-run', {
          body: { budgetFolders: 10 },
          headers,
        });

        // Handle ROOT_MISMATCH (409) - re-arm and retry
        if (syncError?.message?.includes('409') || syncError?.message?.includes('ROOT_MISMATCH')) {
          if (rearmRetries >= MAX_REARM_RETRIES) {
            console.error('[ORCHESTRATOR][run] Max rearm retries reached');
            throw new Error('Falha ao rearmar sincronização após múltiplas tentativas');
          }

          rearmRetries++;
          console.warn(`[ORCHESTRATOR][run] ROOT_MISMATCH detected, re-arming (attempt ${rearmRetries}/${MAX_REARM_RETRIES})...`);
          
          // Backoff
          const backoffMs = 1000 * Math.pow(2, rearmRetries - 1);
          await new Promise(resolve => setTimeout(resolve, backoffMs));

          // Re-arm
          const { error: rearmError } = await supabase.functions.invoke('drive-sync-start', { headers });
          if (rearmError) {
            console.error('[ORCHESTRATOR][run] Rearm failed:', rearmError);
            throw new Error(`Falha ao rearmar: ${rearmError.message}`);
          }

          console.log('[ORCHESTRATOR][run] Re-armed successfully, retrying...');
          continue;
        }

        if (syncError || !syncData?.ok) {
          console.error('[ORCHESTRATOR][run] Sync run failed:', syncError || syncData);
          // Don't throw - we may have partial progress
          break;
        }

        done = syncData.done || false;
        totalProcessed += syncData.processedFolders || 0;
        totalItems += syncData.updatedItems || 0;

        console.log(`[ORCHESTRATOR][run] Batch ${iterations}: processed=${syncData.processedFolders}, queued=${syncData.queued}, done=${done}`);

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

      // Step 5: Run delta sync (changes-pull)
      console.log('[ORCHESTRATOR][delta] Running changes-pull...');
      const { data: deltaData, error: deltaError } = await supabase.functions.invoke('drive-changes-pull', {
        headers,
      });

      if (!deltaError && deltaData?.ok) {
        console.log('[ORCHESTRATOR][delta] OK:', deltaData);
      } else {
        console.warn('[ORCHESTRATOR][delta] Failed:', deltaError);
      }

      setProgress({ 
        phase: 'complete', 
        message: `Sincronização completa! ${totalItems} arquivos indexados`,
        updatedItems: totalItems,
        processedFolders: totalProcessed
      });

      console.log('[ORCHESTRATOR] Full sync complete:', { traceId, totalItems, totalProcessed, iterations });

      toast({
        title: "Sincronização completa",
        description: `${totalItems} arquivos indexados com sucesso`,
      });

      // Trigger refresh event and invalidate cache
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
