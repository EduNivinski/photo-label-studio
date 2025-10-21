import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, httpJson, requireAuth, safeError, getClientIp } from "../_shared/http.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { getDriveClient } from "../_shared/drive_client.ts";

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
    // Support both GET and POST
    let itemId: string | null = null;
    let size = 256;

    if (req.method === 'GET') {
      const url = new URL(req.url);
      itemId = url.searchParams.get('itemId');
      const sizeParam = url.searchParams.get('size') || '256';
      size = parseInt(sizeParam, 10);
    } else if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      itemId = body.itemId;
      size = body.size || 256;
    } else {
      return new Response(JSON.stringify({ 
        ok: false, 
        code: "METHOD_NOT_ALLOWED",
        message: "Only GET, POST, and OPTIONS methods are allowed", 
        traceId 
      }), {
        status: 405,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
        }
      });
    }

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
      return new Response(JSON.stringify({ 
        ok: false, 
        code: "RATE_LIMIT_EXCEEDED",
        message: "Rate limit exceeded", 
        traceId 
      }), {
        status: 429,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
        }
      });
    }

    if (!itemId) {
      return new Response(JSON.stringify({ 
        ok: false, 
        code: "MISSING_ITEM_ID",
        message: "Missing itemId parameter", 
        traceId 
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
        }
      });
    }

    // Normalize itemId: remove "gdrive:" prefix if present
    if (itemId.startsWith('gdrive:')) {
      itemId = itemId.substring(7);
    }

    if (![256, 512, 1024].includes(size)) {
      return new Response(JSON.stringify({ 
        ok: false, 
        code: "INVALID_SIZE",
        message: "Invalid size. Must be 256, 512, or 1024", 
        traceId 
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
        }
      });
    }

    // Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Lookup item by file_id (normalized itemId)
    const { data: item, error: itemError } = await supabase
      .from('drive_items')
      .select('file_id, mime_type, modified_time, md5_checksum, updated_at, thumb_url, thumb_rev, thumbnail_link')
      .eq('user_id', userId)
      .eq('file_id', itemId)
      .maybeSingle();

    if (itemError || !item) {
      console.error(`❌ [${traceId}] Item not found:`, itemError);
      return new Response(JSON.stringify({ 
        ok: false, 
        code: "ITEM_NOT_FOUND",
        message: "Item not found in database", 
        traceId 
      }), {
        status: 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
        }
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
              'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
            }
          }
        );
      }
    }

    // Need to generate thumbnail
    console.log(`🔄 [${traceId}] Generating thumbnail for ${fileId} size=${size} mime=${mimeType}`);

    // Get Drive client with access token
    const driveClient = await getDriveClient(userId, supabase);
    if (!driveClient) {
      return new Response(JSON.stringify({ 
        ok: false, 
        code: "AUTH_FAILED",
        message: "Failed to authenticate with Google Drive", 
        traceId 
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
        }
      });
    }

    const accessToken = driveClient.token;

    let imageBuffer: Uint8Array | null = null;
    const isRaw = mimeType.toLowerCase().includes('cr2') || 
                  mimeType.toLowerCase().includes('nef') || 
                  mimeType.toLowerCase().includes('arw') ||
                  mimeType.toLowerCase().includes('dng');

    if (mimeType.startsWith('image/') || isRaw) {
      // For RAW images, try thumbnailLink first as sharp may not support all RAW formats
      if (isRaw && item.thumbnail_link) {
        console.log(`📸 [${traceId}] RAW image detected, trying thumbnailLink first`);
        try {
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
        } catch (err) {
          console.log(`⚠️ [${traceId}] thumbnailLink failed for RAW, will try direct download:`, err.message);
        }
      }

      // If RAW thumbnailLink failed or not RAW, try direct download
      if (!imageBuffer) {
        const driveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`;
        const driveResp = await fetch(driveUrl, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!driveResp.ok) {
          throw new Error(`Failed to download image: ${driveResp.status} ${driveResp.statusText}`);
        }

        const originalBuffer = new Uint8Array(await driveResp.arrayBuffer());
        
        // Use sharp to resize
        const sharp = (await import('https://deno.land/x/sharp@v0.33.2/mod.ts')).default;
        
        try {
          imageBuffer = await sharp(originalBuffer)
            .resize(size, size, { 
              fit: 'inside', 
              withoutEnlargement: true 
            })
            .webp({ quality: 70 })
            .toBuffer();
        } catch (sharpErr) {
          console.error(`❌ [${traceId}] Sharp processing failed:`, sharpErr.message);
          // For RAW that sharp can't handle, use placeholder
          if (isRaw) {
            const placeholderUrl = 'https://placehold.co/256x256/2a2a2a/white?text=RAW';
            const placeholderResp = await fetch(placeholderUrl);
            imageBuffer = new Uint8Array(await placeholderResp.arrayBuffer());
          } else {
            throw sharpErr;
          }
        }
      }

    } else if (mimeType.startsWith('video/')) {
      console.log(`🎥 [${traceId}] Video detected, trying thumbnailLink`);
      // Try to use Drive's thumbnailLink
      if (item.thumbnail_link) {
        try {
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
            
            console.log(`✅ [${traceId}] Video thumbnail generated from Drive thumbnailLink`);
          }
        } catch (err) {
          console.log(`⚠️ [${traceId}] thumbnailLink processing failed:`, err.message);
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
      // Other file types (PDF, Google Docs, etc): try thumbnailLink or use placeholder
      console.log(`📄 [${traceId}] Other file type: ${mimeType}`);
      if (item.thumbnail_link) {
        try {
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
        } catch (err) {
          console.log(`⚠️ [${traceId}] thumbnailLink processing failed:`, err.message);
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
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
        }
      }
    );

  } catch (error: any) {
    console.error(`❌ [${traceId}] Error:`, error);
    
    if (error?.message === "UNAUTHORIZED" || error?.message?.includes("auth")) {
      return new Response(JSON.stringify({ 
        ok: false, 
        code: "UNAUTHORIZED",
        message: "Authentication failed or token expired", 
        traceId 
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
        }
      });
    }

    if (error?.message?.includes("not found")) {
      return new Response(JSON.stringify({ 
        ok: false, 
        code: "FILE_NOT_FOUND",
        message: "File not found in Google Drive", 
        traceId 
      }), {
        status: 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
        }
      });
    }

    return new Response(JSON.stringify({ 
      ok: false,
      code: "INTERNAL_ERROR",
      message: "Failed to generate thumbnail",
      traceId
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
      }
    });
  }
});
