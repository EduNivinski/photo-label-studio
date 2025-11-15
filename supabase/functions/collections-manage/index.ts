import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth, httpJson } from "../_shared/http.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://photo-label-studio.lovable.app',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Max-Age': '86400',
};

const ManageCollectionsSchema = z.object({
  itemIds: z.array(z.string()).min(1).max(1000),
  action: z.enum(['add', 'remove', 'set']),
  collections: z.array(z.string()).max(100),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const traceId = crypto.randomUUID();

  try {
    if (req.method !== 'POST') throw new Error('METHOD_NOT_ALLOWED');

    const { userId } = await requireAuth(req);

    await checkRateLimit({
      userId,
      ip: req.headers.get('x-forwarded-for') || 'unknown',
      endpoint: 'collections-manage',
      limit: 100,
      windowSec: 60
    });

    const body = await req.json();
    const { itemIds, action, collections } = ManageCollectionsSchema.parse(body);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    console.log('[collections-manage]', { traceId, userId, action, itemIds: itemIds.length, collections });

    // Process each item
    let updated = 0;
    for (const itemId of itemIds) {
      const [source, key] = itemId.split('::');
      const tableName = source === 'db' ? 'photos' : 'drive_items';
      const idColumn = source === 'db' ? 'id' : 'file_id';

      // Get current collections
      const { data: existing } = await admin
        .from(tableName)
        .select('collections')
        .eq('user_id', userId)
        .eq(idColumn, key)
        .maybeSingle();

      if (!existing) continue;

      const currentCollections = existing.collections || [];
      let newCollections: string[];

      if (action === 'add') {
        // Add new collections (avoid duplicates)
        const toAdd = collections.filter(c => !currentCollections.includes(c));
        newCollections = [...currentCollections, ...toAdd];
      } else if (action === 'remove') {
        // Remove specified collections
        newCollections = currentCollections.filter(c => !collections.includes(c));
      } else {
        // Set (replace all collections)
        newCollections = collections;
      }

      // Update the item
      const { error } = await admin
        .from(tableName)
        .update({ collections: newCollections })
        .eq('user_id', userId)
        .eq(idColumn, key);

      if (error) {
        console.error('[collections-manage][error]', { traceId, itemId, error: error.message });
      } else {
        updated++;
      }
    }

    console.log('[collections-manage][success]', { traceId, userId, updated });

    return httpJson(200, {
      ok: true,
      updated,
      traceId
    }, req.headers.get('origin'));

  } catch (error: any) {
    console.error('[collections-manage][error]', { traceId, error: error.message });
    
    if (error.message === 'UNAUTHORIZED') {
      return httpJson(401, { ok: false, code: 'UNAUTHORIZED' }, req.headers.get('origin'));
    }

    return httpJson(500, {
      ok: false,
      code: 'INTERNAL_ERROR',
      message: error.message,
      traceId
    }, req.headers.get('origin'));
  }
});