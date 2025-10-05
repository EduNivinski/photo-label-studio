import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireAuth, httpJson, safeError, getClientIp } from "../_shared/http.ts";
import { checkRateLimit, RATE_LIMITS } from "../_shared/rate-limit.ts";
import { LabelsApplyBatchSchema, validateBody } from "../_shared/validation.ts";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      headers: {
        'Access-Control-Allow-Origin': 'https://photo-label-studio.lovable.app',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      }
    });
  }

  try {
    // Authenticate user
    const { userId } = await requireAuth(req);
    
    // Rate limiting
    const clientIp = getClientIp(req);
    const canProceed = await checkRateLimit({
      userId,
      ip: clientIp,
      endpoint: "labels-apply-batch",
      limit: RATE_LIMITS["labels-apply-batch"].limit,
      windowSec: RATE_LIMITS["labels-apply-batch"].windowSec,
    });

    if (!canProceed) {
      return httpJson(429, { ok: false, error: "Rate limit exceeded. Please try again later." });
    }

    // Validate input
    const body = await req.json().catch(() => ({}));
    const { assetId, toAdd, toRemove } = validateBody(LabelsApplyBatchSchema, body);

    // Extract source and itemKey from assetId
    const [source, itemKey] = assetId.split(':');
    
    if (!source || !itemKey || !['gdrive', 'internal', 'db'].includes(source)) {
      return httpJson(400, { ok: false, error: "Invalid asset format." });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const applied = [];
    const removed = [];
    const errors = [];

    // Process labels to add
    for (const labelId of toAdd) {
      try {
        // Verify label belongs to user
        const { data: label } = await supabase
          .from('labels')
          .select('id')
          .eq('id', labelId)
          .eq('user_id', userId)
          .single();

        if (!label) {
          errors.push("Label not found");
          continue;
        }

        // Add label assignment
        const { error } = await supabase
          .from('labels_items')
          .upsert({
            label_id: labelId,
            source,
            item_key: itemKey
          });

        if (error) {
          console.error('Error adding label:', error);
          errors.push("Failed to add label");
        } else {
          applied.push(labelId);
        }
      } catch (err) {
        console.error('Error processing add label:', err);
        errors.push("Failed to add label");
      }
    }

    // Process labels to remove
    for (const labelId of toRemove) {
      try {
        // Verify label belongs to user
        const { data: label } = await supabase
          .from('labels')
          .select('id')
          .eq('id', labelId)
          .eq('user_id', userId)
          .single();

        if (!label) {
          errors.push("Label not found");
          continue;
        }

        // Remove label assignment
        const { error } = await supabase
          .from('labels_items')
          .delete()
          .eq('label_id', labelId)
          .eq('source', source)
          .eq('item_key', itemKey);

        if (error) {
          console.error('Error removing label:', error);
          errors.push("Failed to remove label");
        } else {
          removed.push(labelId);
        }
      } catch (err) {
        console.error('Error processing remove label:', err);
        errors.push("Failed to remove label");
      }
    }

    // If we're dealing with 'db' source, also update the photos table
    if (source === 'db' || source === 'internal') {
      try {
        // Get current labels from photos table
        const { data: photo } = await supabase
          .from('photos')
          .select('labels')
          .eq('id', itemKey)
          .eq('user_id', userId)
          .single();

        if (photo) {
          let currentLabels = photo.labels || [];
          
          // Add new labels
          for (const labelId of applied) {
            if (!currentLabels.includes(labelId)) {
              currentLabels.push(labelId);
            }
          }
          
          // Remove labels
          currentLabels = currentLabels.filter(id => !removed.includes(id));

          // Update photos table
          await supabase
            .from('photos')
            .update({ labels: currentLabels })
            .eq('id', itemKey)
            .eq('user_id', userId);
        }
      } catch (err) {
        console.error('Error updating photos table:', err);
      }
    }

    return httpJson(200, {
      ok: true,
      applied,
      removed,
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
      publicMessage: "Unable to apply labels.", 
      logContext: "labels-apply-batch" 
    });
  }
});