import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log('[orphans-cleanup] Starting daily cleanup job');

    // Buscar todos os usuários com auto-deleção ativada
    const { data: usersWithAutoDelete, error: usersError } = await admin
      .from('user_drive_settings')
      .select('user_id, auto_delete_orphans_days')
      .eq('auto_delete_enabled', true);

    if (usersError) {
      console.error('[orphans-cleanup] Failed to fetch users:', usersError);
      return new Response(JSON.stringify({ error: usersError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let totalDeleted = 0;
    let usersProcessed = 0;

    for (const user of usersWithAutoDelete || []) {
      const daysThreshold = user.auto_delete_orphans_days || 30;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysThreshold);

      console.log(`[orphans-cleanup] Processing user ${user.user_id}, threshold: ${daysThreshold} days`);

      // 📧 Avisar usuário 5 dias antes
      const warningDate = new Date();
      warningDate.setDate(warningDate.getDate() - (daysThreshold - 5));

      const { data: itemsToWarn } = await admin
        .from('drive_items')
        .select('file_id, name')
        .eq('user_id', user.user_id)
        .eq('origin_status', 'missing')
        .lte('origin_missing_since', warningDate.toISOString())
        .gt('origin_missing_since', cutoffDate.toISOString());

      if (itemsToWarn && itemsToWarn.length > 0) {
        await admin.from('drive_orphan_notifications').insert({
          user_id: user.user_id,
          items_count: itemsToWarn.length,
          sync_id: `warning-${Date.now()}`,
          acknowledged: false
        });
        console.log(`[orphans-cleanup] ⚠️ Sent warning for ${itemsToWarn.length} items`);
      }

      // 🗑️ Deletar itens que ultrapassaram o threshold
      const { data: itemsToDelete } = await admin
        .from('drive_items')
        .select('file_id, name')
        .eq('user_id', user.user_id)
        .eq('origin_status', 'missing')
        .lte('origin_missing_since', cutoffDate.toISOString());

      if (itemsToDelete && itemsToDelete.length > 0) {
        const fileIds = itemsToDelete.map(i => i.file_id);

        const { error: deleteError } = await admin
          .from('drive_items')
          .delete()
          .in('file_id', fileIds)
          .eq('user_id', user.user_id);

        if (deleteError) {
          console.error(`[orphans-cleanup] Failed to delete items for user ${user.user_id}:`, deleteError);
        } else {
          totalDeleted += itemsToDelete.length;
          console.log(`[orphans-cleanup] ✅ Deleted ${itemsToDelete.length} orphans for user ${user.user_id}`);
        }
      }

      usersProcessed++;
    }

    console.log(`[orphans-cleanup] Cleanup completed. Users processed: ${usersProcessed}, Total deleted: ${totalDeleted}`);

    return new Response(JSON.stringify({
      success: true,
      usersProcessed,
      totalDeleted
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('[orphans-cleanup] Exception:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
