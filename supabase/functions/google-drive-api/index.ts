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
      const folderId = url.searchParams.get('folderId');
      const includeSharedDrives = url.searchParams.get('includeSharedDrives') === 'true';
      
      console.log('📂 Fetching Google Drive folders for user:', user.id);
      console.log('📁 Folder ID:', folderId || 'root');
      console.log('🤝 Include Shared Drives:', includeSharedDrives);
      
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

      let allFolders = [];
      let nextPageToken = null;

      // Build query for folders
      let query;
      if (folderId && folderId !== 'root') {
        query = `'${folderId}' in parents and trashed=false`;
      } else {
        query = "mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false";
      }

      const baseParams = new URLSearchParams({
        q: query,
        fields: 'nextPageToken,files(id,name,mimeType,parents,modifiedTime,shortcutDetails)',
        spaces: 'drive',
        supportsAllDrives: 'true',
        includeItemsFromAllDrives: 'true',
        corpora: 'user',
        pageSize: '100',
        orderBy: 'folder,name'
      });

      console.log('🔍 Query:', query);
      console.log('📋 API URL:', `https://www.googleapis.com/drive/v3/files?${baseParams.toString()}`);

      // Fetch all pages of folders
      do {
        const params = new URLSearchParams(baseParams);
        if (nextPageToken) {
          params.set('pageToken', nextPageToken);
        }

        const driveResponse = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
            'Content-Type': 'application/json',
          },
        });

        console.log('📊 API Response Status:', driveResponse.status);

        if (!driveResponse.ok) {
          console.log('❌ Google Drive API error:', driveResponse.status, driveResponse.statusText);
          const errorText = await driveResponse.text();
          console.log('Error details:', errorText);
          
          return new Response(JSON.stringify({ 
            error: 'É necessário autorizar acesso completo ao Google Drive. Verifique as permissões na sua conta.',
            details: 'Failed to fetch folders from Google Drive',
            status: driveResponse.status
          }), {
            status: driveResponse.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const driveData = await driveResponse.json();
        console.log('📁 Folders in this page:', driveData.files?.length || 0);
        
        if (driveData.files) {
          allFolders = allFolders.concat(driveData.files);
        }
        
        nextPageToken = driveData.nextPageToken;
      } while (nextPageToken);

      console.log('✅ Total Google Drive folders fetched:', allFolders.length);

      // If requested, also fetch Shared Drives
      let sharedDrives = [];
      if (includeSharedDrives) {
        try {
          const sharedDrivesResponse = await fetch('https://www.googleapis.com/drive/v3/drives?pageSize=100', {
            headers: {
              'Authorization': `Bearer ${tokenData.access_token}`,
              'Content-Type': 'application/json',
            },
          });

          if (sharedDrivesResponse.ok) {
            const sharedDrivesData = await sharedDrivesResponse.json();
            sharedDrives = sharedDrivesData.drives || [];
            console.log('🤝 Shared Drives fetched:', sharedDrives.length);
          }
        } catch (error) {
          console.log('⚠️ Could not fetch Shared Drives:', error);
        }
      }
      
      return new Response(JSON.stringify({ 
        folders: allFolders,
        sharedDrives: sharedDrives
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (path === 'diagnostics') {
      console.log('🔧 Running Google Drive diagnostics for user:', user.id);
      
      // Get Google Drive tokens for user
      const { data: tokens, error: tokensError } = await supabase
        .rpc('get_google_drive_tokens_secure', { p_user_id: user.id });
        
      if (tokensError || !tokens || tokens.length === 0) {
        return new Response(JSON.stringify({ 
          error: 'No Google Drive connection',
          hasTokens: false,
          diagnostics: {
            tokenError: tokensError?.message || 'No tokens found'
          }
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const tokenData = tokens[0];
      const isExpired = new Date(tokenData.expires_at) < new Date();
      
      const diagnostics = {
        hasTokens: true,
        isExpired: isExpired,
        expiresAt: tokenData.expires_at,
        scopes: tokenData.scopes || [],
        dedicatedFolder: {
          id: tokenData.dedicated_folder_id,
          name: tokenData.dedicated_folder_name
        }
      };

      if (!isExpired) {
        // Test API connectivity
        try {
          const testResponse = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
            headers: {
              'Authorization': `Bearer ${tokenData.access_token}`,
              'Content-Type': 'application/json',
            },
          });
          
          diagnostics.apiConnectivity = {
            status: testResponse.status,
            ok: testResponse.ok
          };
          
          if (testResponse.ok) {
            const userData = await testResponse.json();
            diagnostics.userInfo = {
              email: userData.user?.emailAddress || 'unknown'
            };
          }
        } catch (error) {
          diagnostics.apiConnectivity = {
            error: error.message
          };
        }
      }

      console.log('🔧 Diagnostics completed:', diagnostics);
      
      return new Response(JSON.stringify({ diagnostics }), {
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