import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

// Import signing functions from shared
import { verifyPayload } from "../_shared/signing.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://photo-label-studio.lovable.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
};

// Function to get fresh access token
async function ensureAccessToken(userId: string): Promise<string> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const { data: tokenData, error } = await supabase
    .from('google_drive_tokens')
    .select('access_token_secret_id, refresh_token_secret_id, expires_at')
    .eq('user_id', userId)
    .single();

  if (error || !tokenData) {
    throw new Error('No Drive token found for user');
  }

  // Check if token is expired
  const isExpired = new Date(tokenData.expires_at) <= new Date();
  
  if (isExpired && tokenData.refresh_token_secret_id) {
    // Refresh the token
    const { data: refreshSecret } = await supabase
      .from('vault.decrypted_secrets')
      .select('secret')
      .eq('id', tokenData.refresh_token_secret_id)
      .single();

    if (!refreshSecret) {
      throw new Error('Could not decrypt refresh token');
    }

    // Exchange refresh token for new access token
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: Deno.env.get('GOOGLE_DRIVE_CLIENT_ID')!,
        client_secret: Deno.env.get('GOOGLE_DRIVE_CLIENT_SECRET')!,
        refresh_token: refreshSecret.secret,
        grant_type: 'refresh_token',
      }),
    });

    const tokenResponse = await response.json();
    
    if (!response.ok) {
      throw new Error(`Token refresh failed: ${tokenResponse.error_description || tokenResponse.error}`);
    }

    // Store new access token
    const { data: newSecret } = await supabase
      .from('vault.secrets')
      .insert({ secret: tokenResponse.access_token })
      .select('id')
      .single();

    if (newSecret) {
      await supabase
        .from('google_drive_tokens')
        .update({
          access_token_secret_id: newSecret.id,
          expires_at: new Date(Date.now() + (tokenResponse.expires_in * 1000)).toISOString(),
        })
        .eq('user_id', userId);
    }

    return tokenResponse.access_token;
  } else {
    // Use existing access token
    const { data: accessSecret } = await supabase
      .from('vault.decrypted_secrets')
      .select('secret')
      .eq('id', tokenData.access_token_secret_id)
      .single();

    if (!accessSecret) {
      throw new Error('Could not decrypt access token');
    }

    return accessSecret.secret;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const sig = url.searchParams.get('sig');
    
    if (!sig) {
      return new Response('Missing signature', { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    // Verify signature
    let payload;
    try {
      // Use VIDEO_SIGNING_KEY environment variable
      const originalKey = Deno.env.get("THUMB_SIGNING_KEY");
      const videoKey = Deno.env.get("VIDEO_SIGNING_KEY");
      
      // Temporarily set THUMB_SIGNING_KEY to VIDEO_SIGNING_KEY for verification
      if (videoKey) {
        Deno.env.set("THUMB_SIGNING_KEY", videoKey);
      }
      
      payload = await verifyPayload(sig);
      
      // Restore original key
      if (originalKey) {
        Deno.env.set("THUMB_SIGNING_KEY", originalKey);
      }
    } catch (error) {
      console.error('Signature verification failed:', error);
      return new Response('Invalid signature', { 
        status: 401, 
        headers: corsHeaders 
      });
    }

    const { uid: userId, fileId } = payload;

    // Get fresh access token
    const accessToken = await ensureAccessToken(userId);

    // Build Drive API request
    const driveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    const driveHeaders: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
    };

    // Pass through Range header if present
    const rangeHeader = req.headers.get('range');
    if (rangeHeader) {
      driveHeaders['Range'] = rangeHeader;
    }

    // Make request to Google Drive
    const driveResponse = await fetch(driveUrl, {
      method: req.method,
      headers: driveHeaders,
    });

    if (!driveResponse.ok) {
      console.error('Drive API error:', driveResponse.status, driveResponse.statusText);
      return new Response('Failed to fetch video from Drive', { 
        status: driveResponse.status, 
        headers: corsHeaders 
      });
    }

    // Build response headers
    const responseHeaders = new Headers(corsHeaders);
    
    // Copy important headers from Drive response
    const contentType = driveResponse.headers.get('content-type') || 'video/mp4';
    const contentLength = driveResponse.headers.get('content-length');
    const acceptRanges = driveResponse.headers.get('accept-ranges');
    const contentRange = driveResponse.headers.get('content-range');
    
    responseHeaders.set('Content-Type', contentType);
    
    if (contentLength) {
      responseHeaders.set('Content-Length', contentLength);
    }
    
    if (acceptRanges) {
      responseHeaders.set('Accept-Ranges', acceptRanges);
    }
    
    if (contentRange) {
      responseHeaders.set('Content-Range', contentRange);
    }

    // Return streaming response
    return new Response(driveResponse.body, {
      status: driveResponse.status,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('Error in video-open:', error);
    return new Response('Internal server error', { 
      status: 500, 
      headers: corsHeaders 
    });
  }
});