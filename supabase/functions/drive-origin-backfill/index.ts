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
    const body = await req.json().catch(() => ({}));
    const maxItems = body.maxItems || 500;

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log('[backfill] Starting origin folder backfill for user:', userId);

    // 🔍 Buscar itens com drive_origin_folder inválido ou nulo
    const { data: invalidItems, error: queryError } = await admin
      .from('drive_items')
      .select('file_id, name, drive_origin_folder, parent_id, parents')
      .eq('user_id', userId)
      .eq('status', 'active')
      .or(`drive_origin_folder.is.null,drive_origin_folder.like.%.jpg,drive_origin_folder.like.%.jpeg,drive_origin_folder.like.%.png,drive_origin_folder.like.%.mp4,drive_origin_folder.like.%.mov`)
      .limit(maxItems);

    if (queryError) {
      console.error('[backfill] Query error:', queryError);
      return httpError(500, 'Failed to query items');
    }

    if (!invalidItems || invalidItems.length === 0) {
      console.log('[backfill] No items to fix');
      return httpJson({
        fixed: 0,
        message: 'No items need backfill'
      });
    }

    console.log(`[backfill] Found ${invalidItems.length} items to fix`);

    let fixed = 0;
    let skipped = 0;

    for (const item of invalidItems) {
      try {
        let drive_origin_folder = null;

        // Tentar parent_id primeiro
        const parentId = item.parent_id || (item.parents && item.parents[0]);
        
        if (parentId) {
          const { data: parentFolder } = await admin
            .from('drive_folders')
            .select('name')
            .eq('user_id', userId)
            .eq('folder_id', parentId)
            .maybeSingle();

          if (parentFolder) {
            drive_origin_folder = parentFolder.name;
          }
        }

        if (drive_origin_folder) {
          const { error: updateError } = await admin
            .from('drive_items')
            .update({ drive_origin_folder })
            .eq('user_id', userId)
            .eq('file_id', item.file_id);

          if (updateError) {
            console.error(`[backfill] Failed to update ${item.name}:`, updateError);
            skipped++;
          } else {
            console.log(`[backfill] ✅ Fixed: ${item.name} → ${drive_origin_folder}`);
            fixed++;
          }
        } else {
          console.warn(`[backfill] No folder found for ${item.name}, parent: ${parentId}`);
          skipped++;
        }
      } catch (err) {
        console.error(`[backfill] Error processing ${item.name}:`, err);
        skipped++;
      }
    }

    console.log(`[backfill] Complete: ${fixed} fixed, ${skipped} skipped`);

    return httpJson({
      fixed,
      skipped,
      total: invalidItems.length,
      message: `Backfill complete: ${fixed} items corrected`
    });

  } catch (err) {
    console.error('[backfill] Exception:', err);
    return httpError(500, String(err));
  }
});
