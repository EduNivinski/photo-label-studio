import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, preflight } from "../_shared/cors.ts";

serve(async (req) => {
  const preflightResponse = preflight(req);
  if (preflightResponse) return preflightResponse;

  try {
    const { labelId, source, itemKey } = await req.json();

    if (!labelId || !source || !itemKey) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders(req.headers.get("origin")), "Content-Type": "application/json" }
      });
    }

    if (!["db", "gdrive"].includes(source)) {
      return new Response(JSON.stringify({ error: "Invalid source" }), {
        status: 400,
        headers: { ...corsHeaders(req.headers.get("origin")), "Content-Type": "application/json" }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user ID from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders(req.headers.get("origin")), 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders(req.headers.get("origin")), 'Content-Type': 'application/json' }
      });
    }

    const userId = userData.user.id;

    // Verify user owns the label
    const { data: labelData, error: labelError } = await supabase
      .from('labels')
      .select('id')
      .eq('id', labelId)
      .eq('user_id', userId)
      .single();

    if (labelError || !labelData) {
      return new Response(JSON.stringify({ error: 'Label not found or access denied' }), {
        status: 403,
        headers: { ...corsHeaders(req.headers.get("origin")), 'Content-Type': 'application/json' }
      });
    }

    // Upsert the label assignment
    const { error: insertError } = await supabase
      .from('labels_items')
      .upsert({
        label_id: labelId,
        source,
        item_key: itemKey
      }, {
        onConflict: 'label_id,source,item_key'
      });

    if (insertError) {
      console.error('Error assigning label:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to assign label' }), {
        status: 500,
        headers: { ...corsHeaders(req.headers.get("origin")), 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders(req.headers.get("origin")), "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error('Error in labels-assign:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders(req.headers.get("origin")), 'Content-Type': 'application/json' }
    });
  }
});