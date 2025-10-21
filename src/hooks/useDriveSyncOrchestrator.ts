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
      console.log('[SYNC] Starting full sync:', { traceId, folderId, folderName, folderPath });

      // Step 1: Align root state with current settings (drive-sync-start)
      setProgress({ phase: 'indexing', message: 'Preparando sincronização...' });
      console.log('[SYNC][start] Calling drive-sync-start to align root...', { traceId });
      
      const { data: startData, error: startError } = await supabase.functions.invoke('drive-sync-start', {
        headers,
      });
      
      if (startError || !startData?.ok) {
        const errorMsg = startData?.error || startError?.message || 'Erro ao preparar sincronização';
        console.error('[SYNC][start] Failed:', { traceId, error: errorMsg });
        throw new Error(errorMsg);
      }

      console.log('[SYNC][start] OK:', { 
        traceId, 
        rearmed: startData.rearmed, 
        effectiveRootFolderId: startData.effectiveRootFolderId,
        rootFolderId: startData.rootFolderId 
      });

      // Step 2: Validate that root_folder_id matches folderId
      const { data: diagData, error: diagError } = await supabase.functions.invoke('drive-sync-diagnostics', {
        headers,
      });

      if (diagError || !diagData?.ok) {
        console.error('[SYNC][diag] Failed to get diagnostics:', { traceId, error: diagError });
        throw new Error('Falha ao validar estado de sincronização');
      }

      const currentRoot = diagData.state?.rootFolderId;
      const pending = diagData.state?.pending?.length || 0;
      console.log('[SYNC][diag] Root validation:', { traceId, expected: folderId, actual: currentRoot, pending });

      if (currentRoot !== folderId) {
        console.error('[SYNC][diag] ROOT_MISMATCH detected!', { traceId, expected: folderId, actual: currentRoot });
        throw new Error(`Pasta configurada não corresponde ao estado de sincronização (esperado: ${folderId}, atual: ${currentRoot || 'null'})`);
      }

      setProgress({ phase: 'indexing', message: 'Indexando pasta...' });

      // Step 3: Check if indexing is needed (pending === 0)
      const needsIndex = pending === 0;
      
      if (needsIndex) {
        console.log('[SYNC][index] First sync for this folder, indexing...', { traceId });
        const { data: indexData, error: indexError } = await supabase.functions.invoke('drive-index-folder', {
          headers,
        });

        if (indexError || !indexData?.ok) {
          const errorMsg = indexData?.error || indexError?.message || "Erro ao indexar pasta";
          console.error('[SYNC][index] Failed:', { traceId, error: errorMsg });
          throw new Error(errorMsg);
        }

        console.log('[SYNC][index] OK:', { traceId, totalFiles: indexData.totalFiles, totalFolders: indexData.totalFolders });
        setProgress({ 
          phase: 'syncing', 
          message: `Sincronizando arquivos...`,
          updatedItems: indexData.totalFiles || 0,
          queuedFolders: indexData.totalFolders || 0
        });
      } else {
        console.log('[SYNC][index] Skipping index, pending folders already exist', { traceId, pending });
        setProgress({ 
          phase: 'syncing', 
          message: `Processando pastas pendentes...`,
          queuedFolders: pending
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
        console.log(`[SYNC][run] Iteration ${iterations}...`, { traceId });
        
        const { data: syncData, error: syncError } = await supabase.functions.invoke('drive-sync-run', {
          body: { budgetFolders: 10 },
          headers,
        });

        // Handle ROOT_MISMATCH (409) - re-arm and retry
        if (syncError?.message?.includes('409') || syncError?.message?.includes('ROOT_MISMATCH')) {
          if (rearmRetries >= MAX_REARM_RETRIES) {
            console.error('[SYNC][run] Max rearm retries reached', { traceId });
            throw new Error('Falha ao rearmar sincronização após múltiplas tentativas');
          }

          rearmRetries++;
          console.warn(`[SYNC][run] ROOT_MISMATCH detected, re-arming (attempt ${rearmRetries}/${MAX_REARM_RETRIES})...`, { traceId });
          
          // Backoff
          const backoffMs = 1000 * Math.pow(2, rearmRetries - 1);
          await new Promise(resolve => setTimeout(resolve, backoffMs));

          // Re-arm
          const { error: rearmError } = await supabase.functions.invoke('drive-sync-start', { headers });
          if (rearmError) {
            console.error('[SYNC][run] Rearm failed:', { traceId, error: rearmError });
            throw new Error(`Falha ao rearmar: ${rearmError.message}`);
          }

          console.log('[SYNC][run] Re-armed successfully, retrying...', { traceId });
          continue;
        }

        if (syncError || !syncData?.ok) {
          console.error('[SYNC][run] Sync run failed:', { traceId, error: syncError || syncData });
          // Don't throw - we may have partial progress
          break;
        }

        done = syncData.done || false;
        totalProcessed += syncData.processedFolders || 0;
        totalItems += syncData.updatedItems || 0;

        console.log(`[SYNC][run] Batch ${iterations}:`, { 
          traceId, 
          processedFolders: syncData.processedFolders, 
          queued: syncData.queued, 
          updatedItems: syncData.updatedItems,
          done 
        });

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
      console.log('[SYNC][delta] Running changes-pull...', { traceId });
      const { data: deltaData, error: deltaError } = await supabase.functions.invoke('drive-changes-pull', {
        headers,
      });

      if (!deltaError && deltaData?.ok) {
        console.log('[SYNC][delta] OK:', { traceId, changes: deltaData.changes });
      } else {
        console.warn('[SYNC][delta] Failed:', { traceId, error: deltaError });
      }

      setProgress({ 
        phase: 'complete', 
        message: `Sincronização completa! ${totalItems} arquivos indexados`,
        updatedItems: totalItems,
        processedFolders: totalProcessed
      });

      console.log('[SYNC] Full sync complete:', { traceId, totalItems, totalProcessed, iterations });

      toast({
        title: "Sincronização completa",
        description: `${totalItems} arquivos indexados com sucesso`,
      });

      // Trigger refresh event and invalidate library cache
      window.dispatchEvent(new CustomEvent('google-drive-status-changed'));
      window.dispatchEvent(new CustomEvent('google-drive-sync-complete', {
        detail: { timestamp: Date.now() }
      }));

      return { success: true, totalItems, totalProcessed };

    } catch (error: any) {
      console.error('[SYNC] Error:', error);
      
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
