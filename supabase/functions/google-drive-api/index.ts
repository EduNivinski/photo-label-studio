import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('🚀 GOOGLE DRIVE API CALLED - REAL VERSION');
  
  if (req.method === 'OPTIONS') {
    console.log('✅ OPTIONS request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get auth token from request
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.log('❌ No authorization header');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify user token and get user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.log('❌ Invalid token:', userError);
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('✅ User authenticated:', user.id);

    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();
    console.log('📍 Path:', path);

    if (path === 'folders') {
      console.log('📂 Fetching Google Drive folders for user:', user.id);
      
      // Get Google Drive tokens for user
      const { data: tokens, error: tokensError } = await supabase
        .rpc('get_google_drive_tokens_secure', { p_user_id: user.id });
        
      if (tokensError || !tokens || tokens.length === 0) {
        console.log('❌ No tokens found:', tokensError);
        return new Response(JSON.stringify({ error: 'No Google Drive connection' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const tokenData = tokens[0];
      console.log('✅ Tokens retrieved, expires at:', tokenData.expires_at);

      // Check if token is expired
      if (new Date(tokenData.expires_at) < new Date()) {
        console.log('❌ Token expired');
        return new Response(JSON.stringify({ error: 'Token expired' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Fetch folders from Google Drive API
      const driveResponse = await fetch('https://www.googleapis.com/drive/v3/files?q=mimeType%3D%22application%2Fvnd.google-apps.folder%22&fields=files(id%2Cname)&orderBy=name', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!driveResponse.ok) {
        console.log('❌ Google Drive API error:', driveResponse.status, driveResponse.statusText);
        const errorText = await driveResponse.text();
        console.log('Error details:', errorText);
        return new Response(JSON.stringify({ error: 'Failed to fetch folders from Google Drive' }), {
          status: driveResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const driveData = await driveResponse.json();
      console.log('✅ Google Drive folders fetched:', driveData.files?.length || 0);
      
      const folders = driveData.files || [];
      return new Response(JSON.stringify({ folders }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('❌ Unknown path:', path);
    return new Response(JSON.stringify({ error: 'Not found' }), { 
      status: 404, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});