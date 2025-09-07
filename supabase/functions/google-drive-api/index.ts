import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  console.log('🚀 Google Drive API function called');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('✅ Returning CORS headers for OPTIONS request');
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.split('/').pop();
  console.log('📍 Path extracted:', path);

  try {
    if (path === 'folders') {
      console.log('📂 Routing to handleListFolders');
      return await handleListFolders(req);
    } else if (path === 'set-folder') {
      console.log('⚙️ Routing to handleSetDedicatedFolder');
      return await handleSetDedicatedFolder(req);
    }

    console.log('❌ Path not found:', path);
    return new Response(JSON.stringify({ error: 'Not found', path }), { 
      status: 404, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('💥 Error in google-drive-api function:', error);
    console.error('Error details:', error.message, error.stack);
    
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Get access token for a user with detailed logging
async function getAccessToken(userId: string): Promise<string | null> {
  try {
    console.log('🔐 Getting access token for user:', userId);
    
    const { data: tokens, error } = await supabase.rpc('get_google_drive_tokens_secure', {
      p_user_id: userId
    });

    if (error) {
      console.error('❌ Error getting tokens from RPC:', error);
      return null;
    }

    if (!tokens || tokens.length === 0) {
      console.log('⚠️ No tokens found for user:', userId);
      return null;
    }

    const tokenData = tokens[0];
    console.log('✅ Token retrieved, expires at:', tokenData.expires_at);
    
    // Check if token is expired (with 5 minute buffer)
    const expiresAt = new Date(tokenData.expires_at);
    const now = new Date();
    const bufferTime = 5 * 60 * 1000; // 5 minutes

    if (expiresAt.getTime() - now.getTime() < bufferTime) {
      console.log('⏰ Token expired for user:', userId);
      return null;
    }

    return tokenData.access_token;
    
  } catch (error) {
    console.error('💥 Exception getting access token:', error);
    return null;
  }
}

async function handleListFolders(req: Request) {
  console.log('📂 Starting handleListFolders');
  
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    console.error('❌ No authorization header found');
    return new Response(JSON.stringify({ error: 'Unauthorized - no auth header' }), { 
      status: 401, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const token = authHeader.replace('Bearer ', '');
  console.log('🔍 Verifying user token...');
  
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  
  if (userError || !user) {
    console.error('❌ User authentication failed:', userError);
    return new Response(JSON.stringify({ error: 'Unauthorized - invalid user' }), { 
      status: 401, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  console.log('✅ User authenticated:', user.id);

  const accessToken = await getAccessToken(user.id);
  if (!accessToken) {
    console.error('❌ No access token found for user:', user.id);
    return new Response(JSON.stringify({ error: 'Google Drive not connected or token expired' }), { 
      status: 401, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  console.log('🌐 Making API call to Google Drive...');

  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.folder'&fields=files(id,name,parents)&pageSize=100`,
      {
        headers: { 
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        },
      }
    );

    console.log('📡 Google Drive API response status:', response.status);
    
    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Google Drive API error:', data);
      return new Response(JSON.stringify({ error: 'Failed to fetch folders', details: data }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ Successfully fetched folders from Google Drive:', data.files?.length || 0);
    
    return new Response(JSON.stringify({ folders: data.files || [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (fetchError) {
    console.error('💥 Network error calling Google Drive API:', fetchError);
    return new Response(JSON.stringify({ error: 'Network error calling Google Drive API' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

async function handleSetDedicatedFolder(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
      status: 401, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
      status: 401, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const { folderId, folderName } = await req.json();

  if (!folderId || !folderName) {
    return new Response(JSON.stringify({ error: 'Folder ID and name are required' }), { 
      status: 400, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Update dedicated folder in database
  const { error } = await supabase
    .from('google_drive_tokens')
    .update({
      dedicated_folder_id: folderId,
      dedicated_folder_name: folderName,
    })
    .eq('user_id', user.id);

  if (error) {
    console.error('Failed to set dedicated folder:', error);
    return new Response(JSON.stringify({ error: 'Failed to set dedicated folder' }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ 
    message: 'Dedicated folder set successfully',
    folder: { id: folderId, name: folderName }
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}