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
    return new Response(JSON.stringify({ error: error.message }), {
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
  
  // Store tokens in database if we have a user ID
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  
  if (state) {
    try {
      // First, delete any existing tokens for this user
      await supabase
        .from('google_drive_tokens')
        .delete()
        .eq('user_id', state);

      // Insert new tokens
      const { error: insertError } = await supabase
        .from('google_drive_tokens')
        .insert({
          user_id: state,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: expiresAt.toISOString(),
          scopes: tokens.scope ? tokens.scope.split(' ') : ['https://www.googleapis.com/auth/drive.file']
        });
        
      if (insertError) {
        console.error('Failed to store tokens:', insertError);
        throw insertError;
      }
      
      console.log('Tokens stored successfully for user:', state);
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
          tokens: ${JSON.stringify({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_at: expiresAt.toISOString(),
            user_email: userInfo.email,
            success: true
          })}
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

  // Get stored refresh token
  const { data: tokenData, error: tokenError } = await supabase
    .from('google_drive_tokens')
    .select('refresh_token')
    .eq('user_id', user.id)
    .single();

  if (tokenError || !tokenData) {
    return new Response('No Google Drive connection found', { 
      status: 404, 
      headers: corsHeaders 
    });
  }

  // Refresh the access token
  const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: googleClientId,
      client_secret: googleClientSecret,
      refresh_token: tokenData.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  const refreshTokens = await refreshResponse.json();

  if (!refreshResponse.ok) {
    console.error('Token refresh failed:', refreshTokens);
    return new Response('Failed to refresh token', { 
      status: 400, 
      headers: corsHeaders 
    });
  }

  // Update stored tokens
  const expiresAt = new Date(Date.now() + refreshTokens.expires_in * 1000);
  
  const { error: updateError } = await supabase
    .from('google_drive_tokens')
    .update({
      access_token: refreshTokens.access_token,
      expires_at: expiresAt.toISOString(),
    })
    .eq('user_id', user.id);

  if (updateError) {
    console.error('Failed to update tokens:', updateError);
    return new Response('Failed to update tokens', { 
      status: 500, 
      headers: corsHeaders 
    });
  }

  return new Response(JSON.stringify({
    access_token: refreshTokens.access_token,
    expires_at: expiresAt.toISOString(),
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
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

  // Delete stored tokens
  const { error } = await supabase
    .from('google_drive_tokens')
    .delete()
    .eq('user_id', user.id);

  if (error) {
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

  // Check if user has Google Drive connected
  const { data: tokenData, error: tokenError } = await supabase
    .from('google_drive_tokens')
    .select('dedicated_folder_id, dedicated_folder_name, expires_at')
    .eq('user_id', user.id)
    .single();

  const isConnected = !tokenError && tokenData;
  const isExpired = tokenData && new Date(tokenData.expires_at) < new Date();

  return new Response(JSON.stringify({
    isConnected,
    isExpired,
    dedicatedFolder: tokenData ? {
      id: tokenData.dedicated_folder_id,
      name: tokenData.dedicated_folder_name,
    } : null,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}