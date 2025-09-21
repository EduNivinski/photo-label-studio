import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { ensureAccessToken } from "../_shared/token_provider_v2.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://photo-label-studio.lovable.app',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from JWT
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const userId = userData.user.id;

    // Parse request
    let fileId: string;
    let maxSize = 1600;

    if (req.method === 'GET') {
      const url = new URL(req.url);
      fileId = url.searchParams.get('fileId') || '';
      const maxParam = url.searchParams.get('max');
      if (maxParam) maxSize = parseInt(maxParam) || 1600;
    } else {
      const body = await req.json();
      fileId = body.fileId || '';
      maxSize = body.max || 1600;
    }

    if (!fileId) {
      return new Response(JSON.stringify({ error: 'Missing fileId parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📸 Image preview request: fileId=${fileId}, max=${maxSize}, userId=${userId}`);

    // Check cache first
    const cacheKey = `${userId}/${fileId}_${maxSize}.jpg`;
    const { data: cachedFile } = await supabase.storage
      .from('previews')
      .download(cacheKey);
    
    if (cachedFile) {
      console.log(`✅ Serving cached image: ${cacheKey}`);
      return new Response(cachedFile, {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'public, max-age=86400'
        }
      });
    }

    // Get Drive access token
    const accessToken = await ensureAccessToken(userId);

    // Download original from Drive
    console.log(`⬇️ Downloading original from Drive: ${fileId}`);
    const driveResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (!driveResponse.ok) {
      throw new Error(`Drive API error: ${driveResponse.status} ${driveResponse.statusText}`);
    }

    const imageBuffer = await driveResponse.arrayBuffer();
    console.log(`📥 Downloaded ${imageBuffer.byteLength} bytes from Drive`);

    // For now, we'll serve the original image and add resizing later
    // TODO: Add Sharp for proper resizing
    const processedBuffer = imageBuffer;

    // Cache the processed image
    try {
      const { error: uploadError } = await supabase.storage
        .from('previews')
        .upload(cacheKey, new Uint8Array(processedBuffer), {
          contentType: 'image/jpeg',
          upsert: true
        });
      
      if (uploadError) {
        console.error('Cache upload error:', uploadError);
      } else {
        console.log(`💾 Cached image: ${cacheKey}`);
      }
    } catch (err) {
      console.error('Cache error:', err);
    }

    return new Response(new Uint8Array(processedBuffer), {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=86400'
      }
    });

  } catch (error) {
    console.error('Error in drive-image-preview:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to process image preview',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});