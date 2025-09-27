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
    const { assetId, labelName, labelColor } = await req.json();

    if (!assetId || !labelName?.trim()) {
      return new Response(
        JSON.stringify({ error: 'assetId and labelName are required' }),
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

    const sanitizedName = labelName.trim();
    
    // Check if label already exists for this user
    const { data: existingLabel } = await supabase
      .from('labels')
      .select('id, name, color')
      .eq('user_id', user.id)
      .eq('name', sanitizedName)
      .single();

    let labelToUse = existingLabel;

    // If label doesn't exist, create it
    if (!existingLabel) {
      const { data: newLabel, error: createError } = await supabase
        .from('labels')
        .insert({
          user_id: user.id,
          name: sanitizedName,
          color: labelColor || null
        })
        .select('id, name, color')
        .single();

      if (createError) {
        console.error('Error creating label:', createError);
        return new Response(
          JSON.stringify({ 
            error: 'Failed to create label',
            details: createError.message 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      labelToUse = newLabel;
    }

    // Apply label to the asset
    const { error: applyError } = await supabase
      .from('labels_items')
      .upsert({
        label_id: labelToUse.id,
        source,
        item_key: itemKey
      });

    if (applyError) {
      console.error('Error applying label:', applyError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to apply label to asset',
          details: applyError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
          
          // Add new label if not already present
          if (!currentLabels.includes(labelToUse.id)) {
            currentLabels.push(labelToUse.id);

            // Update photos table
            await supabase
              .from('photos')
              .update({ labels: currentLabels })
              .eq('id', itemKey)
              .eq('user_id', user.id);
          }
        }
      } catch (err) {
        console.error('Error updating photos table:', err);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        label: labelToUse,
        created: !existingLabel
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Create and apply label error:', error);
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