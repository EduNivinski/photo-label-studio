import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Safe JSON response helper
const safeJson = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { 
    status, 
    headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
  });

//Functions que estão dando erro 
let supabase: any;

serve(async (req) => {
  console.log('🚀 GOOGLE DRIVE API CALLED - REAL VERSION');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('✅ OPTIONS request');
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get auth token from request
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.log('❌ No authorization header');
      return safeJson(401, { error: 'Unauthorized' });
    }

    // Verify user token and get user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.log('❌ Invalid token:', userError);
      return safeJson(401, { error: 'Invalid token' });
    }

    console.log('✅ User authenticated:', user.id);

    const url = new URL(req.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    const path = pathSegments[pathSegments.length - 1];
    console.log('📍 Full path:', url.pathname, 'Last segment:', path);

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

      let tokenData = tokens[0];
      console.log('✅ Tokens retrieved, expires at:', tokenData.expires_at);

      // Check token expiration and attempt refresh if needed
      const expiresAt = new Date(tokenData.expires_at);
      const now = new Date();
      
      if (expiresAt <= now) {
        console.log('🔄 Token expired at:', expiresAt.toISOString(), 'attempting refresh...');
        
        // Attempt token refresh
        const refreshResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/google-drive-auth/refresh`, {
          method: 'POST',
          headers: {
            'Authorization': req.headers.get('Authorization') || '',
            'Content-Type': 'application/json'
          }
        });
        
        if (!refreshResponse.ok) {
          console.log('❌ Token refresh failed, requiring reconnection');
          return new Response(JSON.stringify({
            error: 'Token expired and refresh failed',
            message: 'Please reconnect your Google Drive account with updated permissions',
            requires_reconnect: true
          }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        console.log('✅ Token refreshed successfully, retrying request...');
        
        // Get refreshed tokens
        const { data: refreshedTokens, error: refreshError } = await supabase
          .rpc('get_google_drive_tokens_secure', { p_user_id: user.id });
        
        if (refreshError || !refreshedTokens || refreshedTokens.length === 0) {
          return new Response(JSON.stringify({
            error: 'Failed to get refreshed tokens',
            message: 'Please reconnect your Google Drive account'
          }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        tokenData = refreshedTokens[0];
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
          
          // Check if it's a scope/permission issue
          if (driveResponse.status === 403) {
            return new Response(JSON.stringify({
              error: 'Insufficient permissions',
              status: driveResponse.status,
              message: 'Precisamos de permissão para ler metadados do Drive. Clique em "Reconectar com permissões".',
              requires_reconnect: true,
              required_scopes: [
                'https://www.googleapis.com/auth/drive.metadata.readonly',
                'https://www.googleapis.com/auth/drive.file'
              ]
            }), {
              status: driveResponse.status,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          if (driveResponse.status === 401) {
            return new Response(JSON.stringify({
              error: 'Authentication failed',
              status: driveResponse.status,
              message: 'Token expirado ou inválido. Reconecte sua conta do Google Drive.',
              requires_reconnect: true
            }), {
              status: driveResponse.status,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          return new Response(JSON.stringify({ 
            error: 'Google Drive API error',
            status: driveResponse.status,
            message: driveResponse.statusText,
            user_message: 'É necessário autorizar acesso completo ao Google Drive. Verifique as permissões na sua conta.'
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
      return await handleDiagnostics(user.id);
    }

    if (path === 'diagnose-scopes') {
      return await handleDiagnoseScopes(user.id);
    }

    if (path === 'diagnose-listing') {
      return await handleDiagnoseListing(user.id);
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

async function handleDiagnostics(userId: string) {
  console.log('🔧 Running Google Drive diagnostics for user:', userId);
  
  // Get Google Drive tokens for user
  const { data: tokens, error: tokensError } = await supabase
    .rpc('get_google_drive_tokens_secure', { p_user_id: userId });
    
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
    scopes: [], // Will be populated from tokeninfo
    dedicatedFolder: {
      id: tokenData.dedicated_folder_id,
      name: tokenData.dedicated_folder_name
    },
    apiConnectivity: { status: 200, ok: true },
    tokenInfo: null
  };

  // Test API connectivity and get token info if we have tokens
  if (!isExpired) {
    try {
      // Check token scopes via tokeninfo endpoint
      const tokenInfoResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${tokenData.access_token}`);
      
      if (tokenInfoResponse.ok) {
        const tokenInfo = await tokenInfoResponse.json();
        diagnostics.tokenInfo = {
          scopes: tokenInfo.scope ? tokenInfo.scope.split(' ') : [],
          audience: tokenInfo.aud,
          expires_in: tokenInfo.exp ? parseInt(tokenInfo.exp) - Math.floor(Date.now() / 1000) : null
        };
        diagnostics.scopes = diagnostics.tokenInfo.scopes;
      }
      
      // Test Drive API connectivity
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
      console.log('🔧 Diagnostics API test error:', error);
      diagnostics.apiConnectivity = {
        status: 0,
        ok: false,
        error: error.message
      };
    }
  }

  console.log('🔧 Diagnostics completed:', JSON.stringify(diagnostics, null, 2));
  
  return new Response(JSON.stringify(diagnostics), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function handleDiagnoseScopes(userId: string) {
  console.log('🔍 Diagnosing token scopes for user:', userId);
  
  try {
    const { data: tokens, error: tokensError } = await supabase
      .rpc('get_google_drive_tokens_secure', { p_user_id: userId });
      
    if (tokensError || !tokens || tokens.length === 0) {
      console.log('❌ No tokens found for user:', userId);
      return safeJson(400, {
        ok: false,
        error: 'NO_TOKENS',
        details: tokensError?.message || 'No Google Drive connection found'
      });
    }

    const tokenData = tokens[0];
    
    // Test tokeninfo endpoint (minimal implementation)
    console.log('🔍 Testing token scopes via tokeninfo endpoint');
    const tokenInfoResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${tokenData.access_token}`);
    
    const result = {
      ok: tokenInfoResponse.ok,
      status: tokenInfoResponse.status,
      scopes: [],
      hasRequiredScopes: false,
      requiredScopes: [
        'https://www.googleapis.com/auth/drive.metadata.readonly',
        'https://www.googleapis.com/auth/drive.file'
      ]
    };

    if (tokenInfoResponse.ok) {
      const tokenInfo = await tokenInfoResponse.json();
      result.scopes = tokenInfo.scope ? tokenInfo.scope.split(' ') : [];
      result.hasRequiredScopes = result.requiredScopes.every(scope => result.scopes.includes(scope));
      
      console.log('✅ Scopes retrieved successfully:', result.scopes.length, 'scopes found');
    } else {
      console.log('❌ Token info failed with status:', tokenInfoResponse.status);
    }
    
    return safeJson(200, result);
    
  } catch (e: any) {
    console.error('❌ Scope diagnosis error:', { msg: e?.message, code: e?.code, name: e?.name });
    return safeJson(500, { 
      ok: false, 
      error: 'INTERNAL_ERROR', 
      note: 'check function logs' 
    });
  }
}

async function handleDiagnoseListing(userId: string) {
  console.log('📋 Diagnosing Drive file listing for user:', userId);
  
  try {
    const { data: tokens, error: tokensError } = await supabase
      .rpc('get_google_drive_tokens_secure', { p_user_id: userId });
      
    if (tokensError || !tokens || tokens.length === 0) {
      console.log('❌ No tokens found for user:', userId);
      return safeJson(400, {
        ok: false,
        error: 'NO_TOKENS',
        details: tokensError?.message || 'No Google Drive connection found'
      });
    }

    const tokenData = tokens[0];
    
    // Test Drive API listing (minimal implementation)
    console.log('📋 Testing Drive API file listing');
    const url = new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.set("q", "mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false");
    url.searchParams.set("fields", "nextPageToken, files(id,name)");
    url.searchParams.set("supportsAllDrives", "true");
    url.searchParams.set("includeItemsFromAllDrives", "true");
    url.searchParams.set("corpora", "user");
    url.searchParams.set("pageSize", "10");

    const driveResponse = await fetch(url.toString(), {
      headers: { 
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = {
      ok: driveResponse.ok,
      status: driveResponse.status,
      filesCount: 0,
      query: "mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false"
    };

    if (driveResponse.ok) {
      const data = await driveResponse.json();
      result.filesCount = data.files ? data.files.length : 0;
      console.log('✅ Drive API listing successful:', result.filesCount, 'folders found');
    } else {
      console.log('❌ Drive API listing failed with status:', driveResponse.status);
    }
    
    return safeJson(200, result);
    
  } catch (e: any) {
    console.error('❌ Listing diagnosis error:', { msg: e?.message, code: e?.code, name: e?.name });
    return safeJson(500, { 
      ok: false, 
      error: 'INTERNAL_ERROR', 
      note: 'check function logs' 
    });
  }
}