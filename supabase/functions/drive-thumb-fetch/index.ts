import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, httpJson, requireAuth, safeError, getClientIp } from "../_shared/http.ts";
import { checkRateLimit, RATE_LIMITS } from "../_shared/rate-limit.ts";
import { getAccessToken } from "../_shared/token_provider_v2.ts";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204, 
      headers: corsHeaders 
    });
  }

  const traceId = crypto.randomUUID();

  try {
    // Authenticate user
    const { userId } = await requireAuth(req);
    
    // Rate limiting
    const clientIp = getClientIp(req);
    const canProceed = await checkRateLimit({
      userId,
      ip: clientIp,
      endpoint: "drive-thumb-fetch",
      limit: 100,
      windowSec: 60,
    });

    if (!canProceed) {
      return httpJson(429, { 
        ok: false, 
        error: "Rate limit exceeded", 
        traceId 
      });
    }

    // Parse query parameters
    const url = new URL(req.url);
    const itemId = url.searchParams.get('itemId');
    const sizeParam = url.searchParams.get('size') || '256';
    const size = parseInt(sizeParam, 10);

    if (!itemId) {
      return httpJson(400, { 
        ok: false, 
        error: "Missing itemId parameter", 
        traceId 
      });
    }

    if (![256, 512, 1024].includes(size)) {
      return httpJson(400, { 
        ok: false, 
        error: "Invalid size. Must be 256, 512, or 1024", 
        traceId 
      });
    }

    // Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Lookup item
    const { data: item, error: itemError } = await supabase
      .from('drive_items')
      .select('file_id, mime_type, modified_time, md5_checksum, updated_at, thumb_url, thumb_rev, thumbnail_link')
      .eq('user_id', userId)
      .or(`file_id.eq.${itemId},id.eq.${itemId}`)
      .maybeSingle();

    if (itemError || !item) {
      return httpJson(404, { 
        ok: false, 
        error: "Item not found", 
        traceId 
      });
    }

    const fileId = item.file_id;
    const mimeType = item.mime_type || '';
    
    // Calculate revision hash
    const revInput = `${item.modified_time || ''}|${item.md5_checksum || ''}|${item.updated_at || ''}`;
    const revHash = await crypto.subtle.digest(
      'SHA-256', 
      new TextEncoder().encode(revInput)
    );
    const rev = Array.from(new Uint8Array(revHash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .substring(0, 16);

    // Storage path: thumbnails/{userId}/{fileId}/{rev}/{size}.webp
    const storagePath = `${userId}/${fileId}/${rev}/${size}.webp`;

    // Check if thumbnail exists in storage
    const { data: existingFile } = await supabase.storage
      .from('thumbnails')
      .list(`${userId}/${fileId}/${rev}`, {
        limit: 1,
        search: `${size}.webp`
      });

    if (existingFile && existingFile.length > 0) {
      // Thumbnail exists, return signed URL
      const { data: signedUrl } = await supabase.storage
        .from('thumbnails')
        .createSignedUrl(storagePath, 3600); // 1 hour

      if (signedUrl?.signedUrl) {
        console.log(`✅ [${traceId}] Cache hit for ${fileId} size=${size}`);
        return new Response(
          JSON.stringify({ 
            ok: true, 
            url: signedUrl.signedUrl, 
            rev, 
            width: size, 
            height: size, 
            traceId,
            cached: true
          }),
          {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
              'Cache-Control': 'no-store'
            }
          }
        );
      }
    }

    // Need to generate thumbnail
    console.log(`🔄 [${traceId}] Generating thumbnail for ${fileId} size=${size} mime=${mimeType}`);

    // Get access token
    const accessToken = await getAccessToken(userId, supabase);
    if (!accessToken) {
      return httpJson(401, { 
        ok: false, 
        error: "Failed to get access token", 
        traceId 
      });
    }

    let imageBuffer: Uint8Array | null = null;

    if (mimeType.startsWith('image/')) {
      // Download image from Drive
      const driveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`;
      const driveResp = await fetch(driveUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (!driveResp.ok) {
        throw new Error(`Failed to download image: ${driveResp.status}`);
      }

      const originalBuffer = new Uint8Array(await driveResp.arrayBuffer());
      
      // Use sharp to resize (import dynamically)
      const sharp = (await import('https://deno.land/x/sharp@v0.33.2/mod.ts')).default;
      
      imageBuffer = await sharp(originalBuffer)
        .resize(size, size, { 
          fit: 'inside', 
          withoutEnlargement: true 
        })
        .webp({ quality: 70 })
        .toBuffer();

    } else if (mimeType.startsWith('video/')) {
      // Try to use Drive's thumbnailLink
      if (item.thumbnail_link) {
        const thumbResp = await fetch(item.thumbnail_link, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (thumbResp.ok) {
          const thumbBuffer = new Uint8Array(await thumbResp.arrayBuffer());
          const sharp = (await import('https://deno.land/x/sharp@v0.33.2/mod.ts')).default;
          
          imageBuffer = await sharp(thumbBuffer)
            .resize(size, size, { 
              fit: 'inside', 
              withoutEnlargement: true 
            })
            .webp({ quality: 70 })
            .toBuffer();
        }
      }

      // Fallback: use placeholder for videos without thumbnail
      if (!imageBuffer) {
        console.log(`⚠️ [${traceId}] No thumbnail available for video ${fileId}, using placeholder`);
        const placeholderUrl = 'https://placehold.co/256x256/1a1a1a/white?text=Video';
        const placeholderResp = await fetch(placeholderUrl);
        imageBuffer = new Uint8Array(await placeholderResp.arrayBuffer());
      }

    } else {
      // Other file types: try thumbnailLink or use placeholder
      if (item.thumbnail_link) {
        const thumbResp = await fetch(item.thumbnail_link, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (thumbResp.ok) {
          const thumbBuffer = new Uint8Array(await thumbResp.arrayBuffer());
          const sharp = (await import('https://deno.land/x/sharp@v0.33.2/mod.ts')).default;
          
          imageBuffer = await sharp(thumbBuffer)
            .resize(size, size, { 
              fit: 'inside', 
              withoutEnlargement: true 
            })
            .webp({ quality: 70 })
            .toBuffer();
        }
      }

      if (!imageBuffer) {
        const placeholderUrl = 'https://placehold.co/256x256/2a2a2a/white?text=File';
        const placeholderResp = await fetch(placeholderUrl);
        imageBuffer = new Uint8Array(await placeholderResp.arrayBuffer());
      }
    }

    if (!imageBuffer) {
      throw new Error('Failed to generate thumbnail');
    }

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('thumbnails')
      .upload(storagePath, imageBuffer, {
        contentType: 'image/webp',
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) {
      console.error(`❌ [${traceId}] Upload error:`, uploadError);
      throw uploadError;
    }

    // Update drive_items with thumb info
    await supabase
      .from('drive_items')
      .update({
        thumb_rev: rev,
        thumb_updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('file_id', fileId);

    // Get signed URL for the uploaded thumbnail
    const { data: signedUrl } = await supabase.storage
      .from('thumbnails')
      .createSignedUrl(storagePath, 3600);

    console.log(`✅ [${traceId}] Generated and cached thumbnail for ${fileId} size=${size}`);

    return new Response(
      JSON.stringify({ 
        ok: true, 
        url: signedUrl?.signedUrl || '', 
        rev, 
        width: size, 
        height: size, 
        traceId,
        cached: false
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      }
    );

  } catch (error: any) {
    console.error(`❌ [${traceId}] Error:`, error);
    
    if (error?.message === "UNAUTHORIZED") {
      return httpJson(401, { 
        ok: false, 
        error: "Unauthorized", 
        traceId 
      });
    }

    return safeError(error, { 
      publicMessage: "Failed to fetch thumbnail", 
      logContext: `drive-thumb-fetch [${traceId}]` 
    });
  }
});
