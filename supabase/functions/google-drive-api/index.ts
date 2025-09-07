import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1";
import { ensureAccessToken } from "../_shared/token_provider_v2.ts";

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
      
      // Get fresh access token with automatic refresh
      let accessToken;
      try {
        accessToken = await ensureAccessToken(user.id);
        console.log("drive-call token len:", typeof accessToken, String(accessToken).length);
      } catch (error) {
        console.log('❌ Token error:', error);
        return safeJson(401, { 
          error: 'No Google Drive connection',
          requires_reconnect: true
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
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        console.log('📊 API Response Status:', driveResponse.status);

        if (driveResponse.status === 401) {
          // Token expired during call - force refresh and retry once
          console.log('❌ 401. Forcing refresh and retrying...');
          try {
            const freshToken = await ensureAccessToken(user.id);
            const retryResponse = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
              headers: {
                'Authorization': `Bearer ${freshToken}`,
                'Content-Type': 'application/json',
              },
            });
            
            if (!retryResponse.ok) {
              console.log('❌ Still failed after refresh:', retryResponse.status);
              return safeJson(retryResponse.status, { 
                status: retryResponse.status, 
                reason: "UNAUTHORIZED_AFTER_REFRESH",
                requires_reconnect: true
              });
            }
            
            // Success on retry - use this response
            const retryData = await retryResponse.json();
            allFolders = allFolders.concat(retryData.files || []);
            nextPageToken = retryData.nextPageToken || null;
            continue;
          } catch (refreshError) {
            console.log('❌ Refresh failed:', refreshError);
            return safeJson(401, {
              error: 'Token refresh failed',
              requires_reconnect: true
            });
          }
        }

        if (!driveResponse.ok) {
          console.log('❌ Google Drive API error:', driveResponse.status, driveResponse.statusText);
          const errorText = await driveResponse.text();
          console.log('Error details:', errorText);
          
          // Check if it's a scope/permission issue
          if (driveResponse.status === 403) {
            return safeJson(403, {
              error: 'Insufficient permissions',
              status: driveResponse.status,
              message: 'Precisamos de permissão para ler metadados do Drive. Clique em "Reconectar com permissões".',
              requires_reconnect: true,
              required_scopes: [
                'https://www.googleapis.com/auth/drive.metadata.readonly',
                'https://www.googleapis.com/auth/drive.file'
              ]
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

    if (path === 'tokeninfo') {
      return await handleTokenInfo(user.id);
    }

    // Diagnostic endpoints
    if (path === 'diag' && url.searchParams.get('type') === 'scopes') {
      return await handleDiagScopes(user.id);
    }
    
    if (path === 'list-root') {
      return await handleDiagListRoot(user.id);
    }
    
    if (path === 'list-folder') {
      const body = await req.json();
      return await handleDiagListFolder(user.id, body.folderId);
    }
    
    if (path === 'list-shared-drive') {
      return await handleDiagListSharedDrive(user.id);
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

async function handleDiagScopes(userId: string) {
  console.log('🔍 DIAG: Checking token scopes for user:', userId);
  
  try {
    const { data: tokens, error: tokensError } = await supabase
      .rpc('get_google_drive_tokens_secure', { p_user_id: userId });
      
    if (tokensError || !tokens || tokens.length === 0) {
      console.log('❌ DIAG: No tokens found for user:', userId);
      return safeJson(400, {
        status: 400,
        error: 'NO_TOKENS',
        details: tokensError?.message || 'No Google Drive connection found'
      });
    }

    const tokenData = tokens[0];
    
    // Check token expiration
    const isExpired = new Date(tokenData.expires_at) < new Date();
    if (isExpired) {
      console.log('❌ DIAG: Token expired for user:', userId);
      return safeJson(401, {
        status: 401,
        error: 'TOKEN_EXPIRED',
        details: 'Token has expired, please reconnect'
      });
    }
    
    // Call tokeninfo endpoint
    console.log('🔍 DIAG: Calling Google tokeninfo endpoint');
    const tokenInfoResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${tokenData.access_token}`);
    
    if (!tokenInfoResponse.ok) {
      console.log('❌ DIAG: TokenInfo failed with status:', tokenInfoResponse.status);
      return safeJson(tokenInfoResponse.status, {
        status: tokenInfoResponse.status,
        error: 'TOKENINFO_FAILED',
        details: `Google tokeninfo returned ${tokenInfoResponse.status}`
      });
    }

    const tokenInfo = await tokenInfoResponse.json();
    const scopes = tokenInfo.scope ? tokenInfo.scope.split(' ') : [];
    const expiresIn = tokenInfo.exp ? parseInt(tokenInfo.exp) - Math.floor(Date.now() / 1000) : null;
    
    console.log('✅ DIAG: TokenInfo success - scopes found:', scopes.length);
    
    return safeJson(200, {
      status: 200,
      scopes: tokenInfo.scope || '',
      expires_in: expiresIn,
      scopesList: scopes,
      hasRequiredScopes: [
        'https://www.googleapis.com/auth/drive.metadata.readonly',
        'https://www.googleapis.com/auth/drive.file'
      ].every(scope => scopes.includes(scope))
    });
    
  } catch (e: any) {
    console.error('❌ DIAG: Scopes error:', { msg: e?.message, code: e?.code, name: e?.name });
    return safeJson(500, { 
      status: 500,
      error: 'INTERNAL_ERROR', 
      note: 'check function logs' 
    });
  }
}

async function handleDiagListRoot(userId: string) {
  console.log('📋 DIAG: Testing root folder listing for user:', userId);
  
  try {
    const { data: tokens, error: tokensError } = await supabase
      .rpc('get_google_drive_tokens_secure', { p_user_id: userId });
      
    if (tokensError || !tokens || tokens.length === 0) {
      return safeJson(400, { status: 400, error: 'NO_TOKENS' });
    }

    const tokenData = tokens[0];
    
    // Build exact query as specified
    const url = new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.set("q", "mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false");
    url.searchParams.set("fields", "nextPageToken, files(id,name)");
    url.searchParams.set("supportsAllDrives", "true");
    url.searchParams.set("includeItemsFromAllDrives", "true");
    url.searchParams.set("corpora", "user");
    url.searchParams.set("pageSize", "10");

    console.log('📋 DIAG: Root listing URL:', url.toString());

    const driveResponse = await fetch(url.toString(), {
      headers: { 
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!driveResponse.ok) {
      console.log('❌ DIAG: Root listing failed with status:', driveResponse.status);
      
      if (driveResponse.status === 401) {
        return safeJson(401, {
          status: 401,
          error: 'NEEDS_REFRESH',
          action: 'Token needs refresh'
        });
      }
      
      if (driveResponse.status === 403) {
        return safeJson(403, {
          status: 403,
          error: 'insufficientPermissions',
          action: 'reconnect_with_consent',
          authUrlParams: {
            prompt: 'consent',
            include_granted_scopes: false,
            access_type: 'offline',
            scopes: ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/drive.metadata.readonly', 'https://www.googleapis.com/auth/drive.file']
          }
        });
      }
      
      return safeJson(driveResponse.status, {
        status: driveResponse.status,
        error: 'DRIVE_API_ERROR'
      });
    }

    const data = await driveResponse.json();
    const files = data.files || [];
    
    console.log('✅ DIAG: Root listing successful - folders found:', files.length);
    
    return safeJson(200, {
      status: 200,
      filesCount: files.length,
      firstItems: files.slice(0, 5),
      echo: {
        q: "mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false",
        corpora: "user",
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        pageSize: 10
      }
    });
    
  } catch (e: any) {
    console.error('❌ DIAG: Root listing error:', { msg: e?.message, code: e?.code });
    return safeJson(500, { 
      status: 500,
      error: 'INTERNAL_ERROR', 
      note: 'check function logs' 
    });
  }
}

async function handleDiagListFolder(userId: string, folderId: string) {
  console.log('📁 DIAG: Testing folder listing for user:', userId, 'folder:', folderId);
  
  if (!folderId) {
    return safeJson(400, { status: 400, error: 'FOLDER_ID_REQUIRED' });
  }
  
  try {
    const { data: tokens, error: tokensError } = await supabase
      .rpc('get_google_drive_tokens_secure', { p_user_id: userId });
      
    if (tokensError || !tokens || tokens.length === 0) {
      return safeJson(400, { status: 400, error: 'NO_TOKENS' });
    }

    const tokenData = tokens[0];
    
    // Build query for specific folder
    const url = new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.set("q", `'${folderId}' in parents and trashed=false`);
    url.searchParams.set("fields", "nextPageToken, files(id,name)");
    url.searchParams.set("supportsAllDrives", "true");
    url.searchParams.set("includeItemsFromAllDrives", "true");
    url.searchParams.set("corpora", "user");
    url.searchParams.set("pageSize", "10");

    console.log('📁 DIAG: Folder listing URL:', url.toString());

    const driveResponse = await fetch(url.toString(), {
      headers: { 
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!driveResponse.ok) {
      console.log('❌ DIAG: Folder listing failed with status:', driveResponse.status);
      
      if (driveResponse.status === 404) {
        return safeJson(404, {
          status: 404,
          error: 'FOLDER_NOT_FOUND',
          folderId: folderId,
          action: 'Clear folder selection and choose again'
        });
      }
      
      return safeJson(driveResponse.status, {
        status: driveResponse.status,
        error: 'DRIVE_API_ERROR',
        folderId: folderId
      });
    }

    const data = await driveResponse.json();
    const files = data.files || [];
    
    console.log('✅ DIAG: Folder listing successful - items found:', files.length);
    
    return safeJson(200, {
      status: 200,
      filesCount: files.length,
      firstItems: files.slice(0, 5),
      folderId: folderId
    });
    
  } catch (e: any) {
    console.error('❌ DIAG: Folder listing error:', { msg: e?.message, code: e?.code });
    return safeJson(500, { 
      status: 500,
      error: 'INTERNAL_ERROR',
      folderId: folderId, 
      note: 'check function logs' 
    });
  }
}

async function handleDiagListSharedDrive(userId: string) {
  console.log('🤝 DIAG: Testing shared drives listing for user:', userId);
  
  try {
    const { data: tokens, error: tokensError } = await supabase
      .rpc('get_google_drive_tokens_secure', { p_user_id: userId });
      
    if (tokensError || !tokens || tokens.length === 0) {
      return safeJson(400, { status: 400, error: 'NO_TOKENS' });
    }

    const tokenData = tokens[0];
    
    // First, get shared drives
    const drivesResponse = await fetch('https://www.googleapis.com/drive/v3/drives?pageSize=10', {
      headers: { 
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!drivesResponse.ok) {
      console.log('❌ DIAG: Drives listing failed with status:', drivesResponse.status);
      return safeJson(drivesResponse.status, {
        status: drivesResponse.status,
        error: 'DRIVES_API_ERROR'
      });
    }

    const drivesData = await drivesResponse.json();
    const drives = drivesData.drives || [];
    
    if (drives.length === 0) {
      return safeJson(200, {
        status: 200,
        message: 'No shared drives available',
        drivesCount: 0
      });
    }
    
    // Test listing files in the first shared drive
    const firstDrive = drives[0];
    const url = new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.set("corpora", "drive");
    url.searchParams.set("driveId", firstDrive.id);
    url.searchParams.set("supportsAllDrives", "true");
    url.searchParams.set("includeItemsFromAllDrives", "true");
    url.searchParams.set("fields", "files(id,name)");
    url.searchParams.set("pageSize", "10");

    console.log('🤝 DIAG: Shared drive files URL:', url.toString());

    const filesResponse = await fetch(url.toString(), {
      headers: { 
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!filesResponse.ok) {
      console.log('❌ DIAG: Shared drive files failed with status:', filesResponse.status);
      return safeJson(filesResponse.status, {
        status: filesResponse.status,
        error: 'SHARED_DRIVE_FILES_ERROR',
        drive: firstDrive
      });
    }

    const filesData = await filesResponse.json();
    const files = filesData.files || [];
    
    console.log('✅ DIAG: Shared drive listing successful - files found:', files.length);
    
    return safeJson(200, {
      status: 200,
      drive: { id: firstDrive.id, name: firstDrive.name },
      filesCount: files.length,
      firstItems: files.slice(0, 5),
      echo: {
        corpora: "drive",
        driveId: firstDrive.id
      }
    });
    
  } catch (e: any) {
    console.error('❌ DIAG: Shared drives error:', { msg: e?.message, code: e?.code });
    return safeJson(500, { 
      status: 500,
      error: 'INTERNAL_ERROR', 
      note: 'check function logs' 
    });
  }
}

async function handleTokenInfo(userId: string) {
  console.log('🔍 Checking tokeninfo for user:', userId);
  
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
    
    // Check token expiration
    const isExpired = new Date(tokenData.expires_at) < new Date();
    if (isExpired) {
      console.log('❌ Token expired for user:', userId);
      return safeJson(401, {
        ok: false,
        error: 'TOKEN_EXPIRED',
        details: 'Token has expired, please reconnect'
      });
    }
    
    // Call tokeninfo endpoint
    console.log('🔍 Calling Google tokeninfo endpoint');
    const tokenInfoResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${tokenData.access_token}`);
    
    const result = {
      ok: tokenInfoResponse.ok,
      status: tokenInfoResponse.status,
      scopes: [],
      expires_in: null,
      hasRequiredScopes: false,
      requiredScopes: [
        'https://www.googleapis.com/auth/drive.metadata.readonly',
        'https://www.googleapis.com/auth/drive.file'
      ]
    };

    if (tokenInfoResponse.ok) {
      const tokenInfo = await tokenInfoResponse.json();
      result.scopes = tokenInfo.scope ? tokenInfo.scope.split(' ') : [];
      result.expires_in = tokenInfo.exp ? parseInt(tokenInfo.exp) - Math.floor(Date.now() / 1000) : null;
      result.hasRequiredScopes = result.requiredScopes.every(scope => result.scopes.includes(scope));
      
      console.log('✅ TokenInfo retrieved successfully');
      console.log('📋 Scopes found:', result.scopes.length);
      console.log('✅ Has required scopes:', result.hasRequiredScopes);
    } else {
      console.log('❌ TokenInfo failed with status:', tokenInfoResponse.status);
    }
    
    return safeJson(200, result);
    
  } catch (e: any) {
    console.error('❌ TokenInfo error:', { msg: e?.message, code: e?.code, name: e?.name });
    return safeJson(500, { 
      ok: false, 
      error: 'INTERNAL_ERROR', 
      note: 'check function logs' 
    });
  }
}

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