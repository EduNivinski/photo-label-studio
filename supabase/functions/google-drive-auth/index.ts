import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const googleClientId = Deno.env.get('GOOGLE_DRIVE_CLIENT_ID')!;
const googleClientSecret = Deno.env.get('GOOGLE_DRIVE_CLIENT_SECRET')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.split('/').pop();

  try {
    if (path === 'authorize') {
      return handleAuthorize(req);
    } else if (path === 'callback') {
      return handleCallback(req);
    } else if (path === 'refresh') {
      return handleRefresh(req);
    } else if (path === 'disconnect') {
      return handleDisconnect(req);
    } else if (path === 'status') {
      return handleStatus(req);
    }

    return new Response('Not found', { 
      status: 404, 
      headers: corsHeaders 
    });
  } catch (error) {
    console.error('Error in google-drive-auth function:', error);
    // Don't expose internal error details to clients
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function handleAuthorize(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response('Unauthorized', { 
      status: 401, 
      headers: corsHeaders 
    });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  
  if (userError || !user) {
    return new Response('Unauthorized', { 
      status: 401, 
      headers: corsHeaders 
    });
  }

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  
  authUrl.searchParams.set('client_id', googleClientId);
  authUrl.searchParams.set('redirect_uri', `${supabaseUrl}/functions/v1/google-drive-auth/callback`);
  authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/drive.file');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('state', user.id); // Pass user ID in state parameter

  return new Response(JSON.stringify({ authUrl: authUrl.toString() }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleCallback(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const state = url.searchParams.get('state'); // User ID passed in state

  console.log('Callback received - code:', !!code, 'error:', error, 'state:', state);

  if (error) {
    return new Response(`OAuth Error: ${error}`, { 
      status: 400, 
      headers: corsHeaders 
    });
  }

  if (!code) {
    return new Response('Authorization code not found', { 
      status: 400, 
      headers: corsHeaders 
    });
  }

  // Exchange code for tokens
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: googleClientId,
      client_secret: googleClientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: `${supabaseUrl}/functions/v1/google-drive-auth/callback`,
    }),
  });

  const tokens = await tokenResponse.json();

  if (!tokenResponse.ok) {
    console.error('Token exchange failed:', tokens);
    return new Response('Failed to exchange authorization code', { 
      status: 400, 
      headers: corsHeaders 
    });
  }

  console.log('Tokens received successfully');

  // Get user info from Google
  const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  const userInfo = await userResponse.json();
  console.log('User info retrieved:', userInfo.email);
  
  // Store tokens securely using the new encrypted system
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  
  if (state) {
    try {
      // Store tokens using secure encrypted storage
      const { error: storeError } = await supabase
        .rpc('store_google_drive_tokens_secure', {
          p_user_id: state,
          p_access_token: tokens.access_token,
          p_refresh_token: tokens.refresh_token,
          p_expires_at: expiresAt.toISOString(),
          p_scopes: tokens.scope ? tokens.scope.split(' ') : ['https://www.googleapis.com/auth/drive.file']
        });
        
      if (storeError) {
        console.error('Failed to store tokens:', storeError);
        throw storeError;
      }
      
      console.log('Tokens stored securely for user:', state);
    } catch (error) {
      console.error('Database error:', error);
      return new Response(`Database error: ${error.message}`, { 
        status: 500, 
        headers: corsHeaders 
      });
    }
  }

  // Return success page
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Google Drive Connected</title>
      <script>
        window.postMessage({
          type: 'GOOGLE_DRIVE_AUTH_SUCCESS',
          success: true,
          user_email: '${userInfo.email}'
        }, '*');
        
        setTimeout(() => {
          window.close();
        }, 1000);
      </script>
    </head>
    <body>
      <h1>Google Drive Connected Successfully!</h1>
      <p>You can close this window now.</p>
    </body>
    </html>
  `;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}

async function handleRefresh(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), { 
      status: 401, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid authentication' }), { 
      status: 401, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

    try {
      // Get connection info using secure function
      const { data: connectionData, error: connectionError } = await supabase
        .rpc('get_google_drive_connection_info', { p_user_id: user.id });

      if (connectionError || !connectionData || connectionData.length === 0) {
        console.log('No Google Drive connection found for user:', user.id);
        return new Response(JSON.stringify({ error: 'Google Drive not connected' }), { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // For now, return success without actual token refresh since we need to implement
      // a secure token refresh mechanism that doesn't expose tokens
      console.log('Token refresh requested for user:', user.id);

      return new Response(JSON.stringify({
        success: true,
        message: 'Please reconnect your Google Drive account to refresh tokens',
        requires_reconnection: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Unexpected error during token refresh:', error);
      return new Response(JSON.stringify({ error: 'Internal server error' }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
}

async function handleDisconnect(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response('Unauthorized', { 
      status: 401, 
      headers: corsHeaders 
    });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  
  if (userError || !user) {
    return new Response('Unauthorized', { 
      status: 401, 
      headers: corsHeaders 
    });
  }

  try {
    // Get the secret IDs before deleting the record
    const { data: tokenData } = await supabase
      .from('google_drive_tokens')
      .select('access_token_secret_id, refresh_token_secret_id')
      .eq('user_id', user.id)
      .single();

    // Delete the token record from our table
    const { error: deleteError } = await supabase
      .from('google_drive_tokens')
      .delete()
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Failed to delete token record:', deleteError);
      throw deleteError;
    }

    // Clean up encrypted secrets from vault if they exist
    if (tokenData?.access_token_secret_id) {
      await supabase
        .from('vault.secrets')
        .delete()
        .eq('id', tokenData.access_token_secret_id);
    }

    if (tokenData?.refresh_token_secret_id) {
      await supabase
        .from('vault.secrets')
        .delete()
        .eq('id', tokenData.refresh_token_secret_id);
    }

    // Log the disconnection
    await supabase.rpc('log_token_access', {
      p_user_id: user.id,
      p_action: 'TOKEN_DISCONNECTED',
      p_success: true
    });

    console.log('Successfully disconnected and cleaned up tokens for user:', user.id);
  } catch (error) {
    console.error('Failed to disconnect:', error);
    return new Response('Failed to disconnect', { 
      status: 500, 
      headers: corsHeaders 
    });
  }

  return new Response(JSON.stringify({ message: 'Disconnected successfully' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleStatus(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response('Unauthorized', { 
      status: 401, 
      headers: corsHeaders 
    });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  
  if (userError || !user) {
    return new Response('Unauthorized', { 
      status: 401, 
      headers: corsHeaders 
    });
  }

  // Check if user has Google Drive connected using new function
  const { data: connectionData, error: connectionError } = await supabase
    .rpc('get_google_drive_connection_info', { p_user_id: user.id });

  const hasConnection = !connectionError && connectionData && connectionData.length > 0;
  const connectionInfo = hasConnection ? connectionData[0] : null;

  console.log('Status check:', {
    hasConnection,
    isExpired: connectionInfo?.is_expired || null,
    connectionError: connectionError?.message
  });

  return new Response(JSON.stringify({
    isConnected: hasConnection,
    isExpired: connectionInfo?.is_expired || false,
    dedicatedFolder: connectionInfo?.dedicated_folder_id ? {
      id: connectionInfo.dedicated_folder_id,
      name: connectionInfo.dedicated_folder_name,
    } : null,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}