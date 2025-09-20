import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

// Import signing functions from shared
import { signPayload } from "../_shared/signing.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
      return new Response('Unauthorized', { 
        status: 401, 
        headers: corsHeaders 
      });
    }

    const { fileIds } = await req.json();
    
    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return new Response('Invalid fileIds', { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    const baseUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/video-open`;
    const ttlSec = 600; // 10 minutes
    const expiresAt = Date.now() + (ttlSec * 1000);
    
    const urls: Record<string, string> = {};
    
    // Sign URLs for each file ID
    for (const fileId of fileIds) {
      const payload = {
        uid: user.id,
        fileId: fileId,
        exp: expiresAt,
      };
      
      // Use VIDEO_SIGNING_KEY for signing
      const originalKey = Deno.env.get("THUMB_SIGNING_KEY");
      const videoKey = Deno.env.get("VIDEO_SIGNING_KEY");
      
      if (videoKey) {
        Deno.env.set("THUMB_SIGNING_KEY", videoKey);
      }
      
      const signature = await signPayload(payload);
      
      // Restore original key
      if (originalKey) {
        Deno.env.set("THUMB_SIGNING_KEY", originalKey);
      }
      
      urls[fileId] = `${baseUrl}?sig=${signature}`;
    }

    return new Response(JSON.stringify({
      ok: true,
      ttlSec,
      urls,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in get-video-urls:', error);
    return new Response(JSON.stringify({ 
      ok: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});