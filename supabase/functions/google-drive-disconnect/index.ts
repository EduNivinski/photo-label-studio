import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { deleteTokens } from '../_shared/token_provider_v2.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://tcupxcxyylxfgsbhfdhw.supabase.co',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  console.log("🗑️ Google Drive Disconnect called");

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'MISSING_AUTH', message: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'INVALID_USER', message: 'Failed to authenticate user' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🗑️ Disconnecting Google Drive for user: ${user.id}`);

    // Delete tokens using the secure token provider
    await deleteTokens(user.id);

    console.log(`✅ Successfully disconnected Google Drive for user: ${user.id}`);

    return new Response(
      JSON.stringify({ 
        status: 'OK', 
        message: 'Google Drive disconnected successfully',
        user_id: user.id
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('❌ Error in google-drive-disconnect:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'INTERNAL_ERROR', 
        message: error.message || 'An internal error occurred' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});