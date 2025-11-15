import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireAuth, httpJson, safeError, getClientIp } from "../_shared/http.ts";
import { checkRateLimit, RATE_LIMITS } from "../_shared/rate-limit.ts";
import { validateBody } from "../_shared/validation.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const LabelsApplyBulkSchema = z.object({
  assetIds: z.array(z.string().min(1).max(512)).min(1).max(1000),
  toAdd: z.array(z.string().uuid()).max(100).default([]),
  toRemove: z.array(z.string().uuid()).max(100).default([]),
});

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      }
    });
  }

  try {
    // Authenticate user
    const { userId } = await requireAuth(req);
    
    // Rate limiting: 5000 assets per minute
    const clientIp = getClientIp(req);
    const canProceed = await checkRateLimit({
      userId,
      ip: clientIp,
      endpoint: "labels-apply-bulk",
      limit: 5000,
      windowSec: 60,
    });

    if (!canProceed) {
      return httpJson(429, { ok: false, error: "Rate limit exceeded. Please try again later." });
    }

    // Validate input
    const body = await req.json().catch(() => ({}));
    const { assetIds, toAdd, toRemove } = validateBody(LabelsApplyBulkSchema, body);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify all labels belong to user
    if (toAdd.length > 0 || toRemove.length > 0) {
      const allLabelIds = [...toAdd, ...toRemove];
      const { data: userLabels } = await supabase
        .from('labels')
        .select('id')
        .eq('user_id', userId)
        .in('id', allLabelIds);

      if (!userLabels || userLabels.length !== allLabelIds.length) {
        return httpJson(403, { ok: false, error: "One or more labels not found or not owned by user." });
      }
    }

    // Group assets by source
    const assetsBySource: { [key: string]: string[] } = {};
    const errors: Array<{ assetId: string; reason: string }> = [];

    for (const assetId of assetIds) {
      const [source, key] = assetId.split(':', 2);
      if (!source || !key || !['db', 'gdrive', 'internal'].includes(source)) {
        errors.push({ assetId, reason: "Invalid asset format" });
        continue;
      }
      
      if (!assetsBySource[source]) {
        assetsBySource[source] = [];
      }
      assetsBySource[source].push(key);
    }

    let appliedCount = 0;
    let removedCount = 0;

    // Process 'db' and 'internal' sources (photos table)
    const dbKeys = [...(assetsBySource['db'] || []), ...(assetsBySource['internal'] || [])];
    if (dbKeys.length > 0) {
      // Process in batches of 100
      const batchSize = 100;
      for (let i = 0; i < dbKeys.length; i += batchSize) {
        const batch = dbKeys.slice(i, i + batchSize);
        
        try {
          // Add labels
          if (toAdd.length > 0) {
            const { error } = await supabase
              .from('photos')
              .update({
                labels: supabase.rpc('array_unique', {
                  arr: supabase.raw(`array_cat(labels, ARRAY[${toAdd.map(id => `'${id}'`).join(',')}]::text[])`)
                })
              })
              .in('id', batch)
              .eq('user_id', userId);

            if (error) {
              console.error('Error adding labels to photos:', error);
              batch.forEach(id => errors.push({ assetId: `db:${id}`, reason: "Failed to add labels" }));
            } else {
              appliedCount += batch.length * toAdd.length;
            }
          }

          // Remove labels
          if (toRemove.length > 0) {
            const { error } = await supabase
              .from('photos')
              .update({
                labels: supabase.raw(`array(
                  SELECT unnest(labels)
                  EXCEPT
                  SELECT unnest(ARRAY[${toRemove.map(id => `'${id}'`).join(',')}]::text[])
                )`)
              })
              .in('id', batch)
              .eq('user_id', userId);

            if (error) {
              console.error('Error removing labels from photos:', error);
              batch.forEach(id => errors.push({ assetId: `db:${id}`, reason: "Failed to remove labels" }));
            } else {
              removedCount += batch.length * toRemove.length;
            }
          }
        } catch (err) {
          console.error('Error processing batch:', err);
          batch.forEach(id => errors.push({ assetId: `db:${id}`, reason: "Batch processing failed" }));
        }
      }
    }

    // Process 'gdrive' source (labels_items table)
    const gdriveKeys = assetsBySource['gdrive'] || [];
    if (gdriveKeys.length > 0) {
      // Process in batches of 100
      const batchSize = 100;
      for (let i = 0; i < gdriveKeys.length; i += batchSize) {
        const batch = gdriveKeys.slice(i, i + batchSize);
        
        try {
          // Add labels
          if (toAdd.length > 0) {
            const insertValues = [];
            for (const itemKey of batch) {
              for (const labelId of toAdd) {
                insertValues.push({ label_id: labelId, source: 'gdrive', item_key: itemKey });
              }
            }

            const { error } = await supabase
              .from('labels_items')
              .upsert(insertValues, { onConflict: 'label_id,source,item_key', ignoreDuplicates: true });

            if (error) {
              console.error('Error adding labels to gdrive items:', error);
              batch.forEach(id => errors.push({ assetId: `gdrive:${id}`, reason: "Failed to add labels" }));
            } else {
              appliedCount += batch.length * toAdd.length;
            }
          }

          // Remove labels
          if (toRemove.length > 0) {
            for (const labelId of toRemove) {
              const { error } = await supabase
                .from('labels_items')
                .delete()
                .eq('label_id', labelId)
                .eq('source', 'gdrive')
                .in('item_key', batch);

              if (error) {
                console.error('Error removing label from gdrive items:', error);
                batch.forEach(id => errors.push({ assetId: `gdrive:${id}`, reason: "Failed to remove labels" }));
              } else {
                removedCount += batch.length;
              }
            }
          }
        } catch (err) {
          console.error('Error processing gdrive batch:', err);
          batch.forEach(id => errors.push({ assetId: `gdrive:${id}`, reason: "Batch processing failed" }));
        }
      }
    }

    return httpJson(200, {
      ok: true,
      applied: appliedCount,
      removed: removedCount,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return httpJson(401, { ok: false, error: "Unauthorized." });
    }
    if (error?.message === "VALIDATION_FAILED") {
      return httpJson(400, { ok: false, error: "Invalid request data." });
    }
    return safeError(error, { 
      publicMessage: "Unable to apply labels in bulk.", 
      logContext: "labels-apply-bulk" 
    });
  }
});
