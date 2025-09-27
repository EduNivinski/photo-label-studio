import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { assetId, toAdd = [], toRemove = [] } = await req.json();

    if (!assetId || (!toAdd.length && !toRemove.length)) {
      return new Response(
        JSON.stringify({ error: 'assetId and at least one of toAdd/toRemove are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract source and itemKey from assetId
    const [source, itemKey] = assetId.split(':');
    
    if (!source || !itemKey) {
      return new Response(
        JSON.stringify({ error: 'Invalid assetId format. Expected source:itemKey' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['gdrive', 'internal', 'db'].includes(source)) {
      return new Response(
        JSON.stringify({ error: 'Invalid source. Must be gdrive, internal, or db' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get JWT from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
          .eq('user_id', user.id)
          .single();

        if (!label) {
          errors.push(`Label ${labelId} not found or not owned by user`);
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
          errors.push(`Failed to add label ${labelId}: ${error.message}`);
        } else {
          applied.push(labelId);
        }
      } catch (err) {
        console.error('Error processing add label:', err);
        errors.push(`Failed to add label ${labelId}: ${err.message}`);
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
          .eq('user_id', user.id)
          .single();

        if (!label) {
          errors.push(`Label ${labelId} not found or not owned by user`);
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
          errors.push(`Failed to remove label ${labelId}: ${error.message}`);
        } else {
          removed.push(labelId);
        }
      } catch (err) {
        console.error('Error processing remove label:', err);
        errors.push(`Failed to remove label ${labelId}: ${err.message}`);
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
          .eq('user_id', user.id)
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
            .eq('user_id', user.id);
        }
      } catch (err) {
        console.error('Error updating photos table:', err);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        applied,
        removed,
        errors: errors.length > 0 ? errors : undefined
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Batch apply labels error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});