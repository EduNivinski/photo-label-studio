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

const ConvertBulkSchema = z.object({
  sourceFolder: z.string().min(1),
  collectionName: z.string().min(1).max(100),
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
      endpoint: 'collections-convert-bulk',
      limit: 10,
      windowSec: 60
    });

    const body = await req.json();
    const { sourceFolder, collectionName } = ConvertBulkSchema.parse(body);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    console.log('[collections-convert-bulk]', { traceId, userId, sourceFolder, collectionName });

    // Update drive_items with matching drive_origin_folder
    const { data: driveItems, error: driveError } = await admin
      .from('drive_items')
      .select('file_id, collections')
      .eq('user_id', userId)
      .eq('drive_origin_folder', sourceFolder)
      .eq('status', 'active');

    if (driveError) {
      console.error('[collections-convert-bulk][drive-error]', { traceId, error: driveError.message });
    }

    // Update photos with matching drive_origin_folder
    const { data: photos, error: photosError } = await admin
      .from('photos')
      .select('id, collections')
      .eq('user_id', userId)
      .eq('drive_origin_folder', sourceFolder);

    if (photosError) {
      console.error('[collections-convert-bulk][photos-error]', { traceId, error: photosError.message });
    }

    let updatedDrive = 0;
    let updatedPhotos = 0;

    // Update drive_items
    if (driveItems && driveItems.length > 0) {
      for (const item of driveItems) {
        const currentCollections = item.collections || [];
        if (!currentCollections.includes(collectionName)) {
          const { error } = await admin
            .from('drive_items')
            .update({ collections: [...currentCollections, collectionName] })
            .eq('user_id', userId)
            .eq('file_id', item.file_id);

          if (!error) updatedDrive++;
        }
      }
    }

    // Update photos
    if (photos && photos.length > 0) {
      for (const photo of photos) {
        const currentCollections = photo.collections || [];
        if (!currentCollections.includes(collectionName)) {
          const { error } = await admin
            .from('photos')
            .update({ collections: [...currentCollections, collectionName] })
            .eq('user_id', userId)
            .eq('id', photo.id);

          if (!error) updatedPhotos++;
        }
      }
    }

    const total = updatedDrive + updatedPhotos;

    console.log('[collections-convert-bulk][success]', { 
      traceId, 
      userId, 
      sourceFolder, 
      collectionName, 
      updatedDrive, 
      updatedPhotos,
      total 
    });

    return httpJson(200, {
      ok: true,
      converted: total,
      updatedDrive,
      updatedPhotos,
      traceId
    }, req.headers.get('origin'));

  } catch (error: any) {
    console.error('[collections-convert-bulk][error]', { traceId, error: error.message });
    
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