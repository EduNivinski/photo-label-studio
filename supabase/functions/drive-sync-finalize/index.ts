import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth, httpJson, httpError } from "../_shared/http.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const userId = await requireAuth(req);
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log('[sync-finalize] Starting orphan detection for user:', userId);

    // Buscar estado da sync
    const { data: state, error: stateError } = await admin
      .from('drive_sync_state')
      .select('last_full_scan_at, root_folder_id')
      .eq('user_id', userId)
      .single();

    if (stateError || !state) {
      return httpError(500, 'Failed to read sync state');
    }

    const syncStartTime = state.last_full_scan_at;
    if (!syncStartTime) {
      return httpJson({ message: 'No full scan timestamp found, skipping orphan detection' });
    }

    // 🔍 Detectar itens que NÃO foram vistos nesta sincronização
    const { data: missingItems, error: missingError } = await admin
      .from('drive_items')
      .select('file_id, name, labels, collections')
      .eq('user_id', userId)
      .eq('origin_status', 'active')
      .or(`last_sync_seen.is.null,last_sync_seen.lt.${syncStartTime}`)
      .eq('trashed', false);

    if (missingError) {
      console.error('[sync-finalize] Error querying missing items:', missingError);
      return httpError(500, 'Failed to detect orphans');
    }

    console.log('[sync-finalize] Found', missingItems?.length || 0, 'missing items');

    if (missingItems && missingItems.length > 0) {
      const fileIds = missingItems.map(i => i.file_id);
      const now = new Date().toISOString();

      // ✅ Marcar como 'missing' ao invés de deletar
      const { error: updateError } = await admin
        .from('drive_items')
        .update({
          origin_status: 'missing',
          origin_missing_since: now,
          drive_origin_folder: null,
          origin_missing_notified: false
        })
        .in('file_id', fileIds)
        .eq('user_id', userId);

      if (updateError) {
        console.error('[sync-finalize] Failed to mark items as missing:', updateError);
        return httpError(500, 'Failed to update orphan status');
      }

      // 📢 Criar notificação
      const syncId = crypto.randomUUID();
      const { error: notifError } = await admin
        .from('drive_orphan_notifications')
        .insert({
          user_id: userId,
          items_count: missingItems.length,
          sync_id: syncId,
          acknowledged: false
        });

      if (notifError) {
        console.error('[sync-finalize] Failed to create notification:', notifError);
      }

      console.log('[sync-finalize] ✅ Marked', missingItems.length, 'items as orphans');

      return httpJson({
        orphansDetected: missingItems.length,
        syncId,
        message: `${missingItems.length} arquivo(s) não foram encontrados no Drive e foram movidos para Arquivos Órfãos`
      });
    }

    return httpJson({
      orphansDetected: 0,
      message: 'Nenhum arquivo órfão detectado'
    });

  } catch (err) {
    console.error('[sync-finalize] Exception:', err);
    return httpError(500, String(err));
  }
});
