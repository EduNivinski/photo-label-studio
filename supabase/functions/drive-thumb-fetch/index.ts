import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getDriveClient } from "../_shared/drive_client.ts";

// Dynamic sharp loader (fallback to no-sharp pipeline)
let SharpMod: any | null = null;
async function loadSharp() {
  if (SharpMod !== null) return SharpMod;
  try {
    // @deno-types="npm:@types/sharp@^0.32.0"
    const mod = await import("npm:sharp@0.33.0");
    SharpMod = (mod as any).default || mod;
  } catch (_e) {
    SharpMod = null; // sharp unavailable on this platform/runtime
  }
  return SharpMod;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://photo-label-studio.lovable.app',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, cache-control, x-client-info, apikey',
  'Access-Control-Max-Age': '86400',
  'Cache-Control': 'no-store',
  'Vary': 'Origin',
};

function jsonResponse(status: number, body: any): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    }
  });
}

async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const traceId = crypto.randomUUID();
  console.log('[thumb][start]', { traceId, method: req.method });

  try {
    // Parse input
    let itemId: string | undefined;
    let size = 256;
    let userId: string | undefined;

    if (req.method === "GET") {
      const url = new URL(req.url);
      itemId = url.searchParams.get("itemId") ?? undefined;
      size = (parseInt(url.searchParams.get("size") ?? "256", 10) === 1024 ? 1024 : 256);
    } else if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      itemId = body.itemId;
      size = (parseInt(String(body.size ?? "256"), 10) === 1024 ? 1024 : 256);
    } else {
      console.log('[thumb][error]', { traceId, code: 'METHOD_NOT_ALLOWED' });
      return jsonResponse(405, { ok: false, code: "METHOD_NOT_ALLOWED", traceId });
    }

    if (!itemId) {
      console.log('[thumb][error]', { traceId, code: 'INVALID_INPUT', message: 'itemId is required' });
      return jsonResponse(400, { ok: false, code: "INVALID_INPUT", message: "itemId is required", traceId });
    }

    // Normalize prefix
    const fileId = String(itemId).replace(/^gdrive:/, "");
    console.log('[thumb][normalized]', { traceId, fileId, size });

    // Get user from auth header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      console.log('[thumb][error]', { traceId, code: 'UNAUTHORIZED', reason: 'missing_header' });
      return jsonResponse(401, { ok: false, code: "UNAUTHORIZED", traceId });
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // Verify token and get user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.log('[thumb][error]', { traceId, code: 'UNAUTHORIZED', reason: 'invalid_token', authError });
      return jsonResponse(401, { ok: false, code: "UNAUTHORIZED", traceId });
    }
    
    userId = user.id;
    console.log('[thumb][auth]', { traceId, userId });

    // Get drive item metadata (DB first)
    const { data: driveItem, error: itemError } = await supabase
      .from('drive_items')
      .select('file_id, mime_type, modified_time, md5_checksum, updated_at, thumbnail_link')
      .eq('user_id', userId)
      .eq('file_id', fileId)
      .maybeSingle();

    if (itemError) {
      console.log('[thumb][error]', { traceId, code: 'DB_ERROR', itemError });
      return jsonResponse(500, { ok: false, code: "DB_ERROR", message: itemError.message, traceId });
    }

    // Prepare variables possibly from Drive fallback
    let mimeType = driveItem?.mime_type || '';
    let modifiedTime = driveItem?.modified_time || '';
    let thumbLink = driveItem?.thumbnail_link || '';

    // Create Drive client (needed for Drive fallback and downloads)
    const driveClient = await getDriveClient(userId, supabase);
    if (!driveClient) {
      console.log('[thumb][error]', { traceId, code: 'DRIVE_TOKEN_EXPIRED' });
      return jsonResponse(401, { ok: false, code: "DRIVE_TOKEN_EXPIRED", message: "Drive token expired or invalid", traceId });
    }

    if (!driveItem) {
      // Fallback: fetch metadata directly from Drive
      try {
        const metaUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,modifiedTime,hasThumbnail,thumbnailLink&supportsAllDrives=true`;
        const metaResp = await fetch(metaUrl, { headers: { Authorization: `Bearer ${driveClient.token}` } });
        if (metaResp.status === 404) {
          console.log('[thumb][error]', { traceId, code: 'FILE_NOT_FOUND', fileId });
          return jsonResponse(404, { ok: false, code: "FILE_NOT_FOUND", message: "File not found", traceId });
        }
        if (!metaResp.ok) {
          console.log('[thumb][error]', { traceId, code: 'DRIVE_FETCH_FAILED', status: metaResp.status });
          return jsonResponse(502, { ok: false, code: "DRIVE_FETCH_FAILED", message: `Failed to fetch metadata: ${metaResp.status}`, traceId });
        }
        const meta = await metaResp.json();
        mimeType = meta.mimeType || '';
        modifiedTime = meta.modifiedTime || '';
        thumbLink = meta.thumbnailLink || '';
      } catch (e) {
        console.log('[thumb][error]', { traceId, code: 'DRIVE_FETCH_FAILED', error: String(e) });
        return jsonResponse(502, { ok: false, code: "DRIVE_FETCH_FAILED", message: String(e), traceId });
      }
    }

    console.log('[thumb][metadata]', { traceId, fileId, mimeType });

    // Calculate revision hash (sha1 of fileId:modifiedTime)
    const revInput = `${fileId}:${modifiedTime || ''}`;
    const revHashBuffer = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(revInput));
    const rev = Array.from(new Uint8Array(revHashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .substring(0, 16);

    // Check cache in storage (try WEBP then JPG)
    const basePath = `${userId}/${fileId}/${rev}/${size}`;

    const trySign = async (ext: string) => {
      const { data } = await supabase.storage
        .from('thumbnails')
        .createSignedUrl(`${basePath}.${ext}`, 3600);
      return data?.signedUrl ? { url: data.signedUrl, key: `${basePath}.${ext}` } : null;
    };

    let signed = await trySign('webp');
    if (!signed) signed = await trySign('jpg');

    if (signed) {
      console.log('[thumb][cache-hit]', { traceId, key: signed.key });
      return jsonResponse(200, {
        ok: true,
        url: signed.url,
        rev,
        width: size,
        height: size,
        traceId
      });
    }

    console.log('[thumb][cache-miss]', { traceId, key: basePath });

    // Cache miss - generate thumbnail
    console.log('[thumb][generate]', { traceId, fileId, mimeType });

    // Drive client already initialized above

    let imageBuffer: ArrayBuffer | null = null;

    // Decide pipeline based on sharp availability
    const sharpMod = await loadSharp();
    const useSharp = !!sharpMod;

    // Handle different mime types
    const isRaw = mimeType.startsWith('image/') && /(cr2|nef|arw|raf|dng|orf|rw2)$/i.test(mimeType.split('/')[1] || '');

    if (mimeType.startsWith('image/') && !isRaw) {
      if (useSharp) {
        // Prefer full image when we can resize it with sharp
        const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`;
        try {
          const response = await fetch(downloadUrl, {
            headers: { Authorization: `Bearer ${driveClient.token}` }
          });

          if (!response.ok) {
            console.log('[thumb][error]', { traceId, code: 'DRIVE_FETCH_FAILED', status: response.status });
            return jsonResponse(502, { ok: false, code: "DRIVE_FETCH_FAILED", message: `Status ${response.status}`, traceId });
          }

          imageBuffer = await response.arrayBuffer();
          console.log('[thumb][downloaded]', { traceId, fileId, bytes: imageBuffer.byteLength });
        } catch (fetchErr) {
          console.log('[thumb][error]', { traceId, code: 'DRIVE_FETCH_FAILED', error: String(fetchErr) });
          return jsonResponse(502, { ok: false, code: "DRIVE_FETCH_FAILED", message: String(fetchErr), traceId });
        }
      } else {
        // No sharp available: use Drive's thumbnail instead of downloading full image
        const link = thumbLink || (driveItem?.thumbnail_link || '');
        if (link) {
          try {
            const thumbResponse = await fetch(link, {
              headers: { Authorization: `Bearer ${driveClient.token}` }
            });

            if (thumbResponse.ok) {
              imageBuffer = await thumbResponse.arrayBuffer();
              console.log('[thumb][thumb-fetched-no-sharp]', { traceId, fileId, bytes: imageBuffer.byteLength });
            } else {
              console.log('[thumb][warning]', { traceId, reason: 'thumb_fetch_failed', status: thumbResponse.status });
              return jsonResponse(502, { ok: false, code: "DRIVE_FETCH_FAILED", message: `Thumb status ${thumbResponse.status}`, traceId });
            }
          } catch (thumbErr) {
            console.log('[thumb][warning]', { traceId, reason: 'thumb_fetch_error', error: String(thumbErr) });
            return jsonResponse(502, { ok: false, code: "DRIVE_FETCH_FAILED", message: String(thumbErr), traceId });
          }
        }
      }
    } else if (mimeType.startsWith('video/') || isRaw) {
      // Use Drive's thumbnail for videos and RAW images
      const link = thumbLink || (driveItem?.thumbnail_link || '');
      if (link) {
        try {
          const thumbResponse = await fetch(link, {
            headers: { Authorization: `Bearer ${driveClient.token}` }
          });

          if (thumbResponse.ok) {
            imageBuffer = await thumbResponse.arrayBuffer();
            console.log('[thumb][thumb-fetched]', { traceId, fileId, bytes: imageBuffer.byteLength });
          } else {
            console.log('[thumb][warning]', { traceId, reason: 'thumb_fetch_failed', status: thumbResponse.status });
            return jsonResponse(502, { ok: false, code: "DRIVE_FETCH_FAILED", message: `Thumb status ${thumbResponse.status}`, traceId });
          }
        } catch (thumbErr) {
          console.log('[thumb][warning]', { traceId, reason: 'thumb_fetch_error', error: String(thumbErr) });
          return jsonResponse(502, { ok: false, code: "DRIVE_FETCH_FAILED", message: String(thumbErr), traceId });
        }
      }
    }

    // If we don't have an image buffer, return not found (no data: placeholders for Home)
    if (!imageBuffer) {
      console.log('[thumb][error]', { traceId, code: 'FILE_NOT_FOUND', mimeType });
      return jsonResponse(404, { ok: false, code: "FILE_NOT_FOUND", message: "No preview available", traceId });
    }


    // Process with sharp
    let webpBuffer: Buffer;
    try {
      webpBuffer = await sharp(Buffer.from(imageBuffer))
        .resize({
          width: size,
          height: size,
          fit: 'inside',
          withoutEnlargement: true
        })
        .webp({ quality: 82 })
        .toBuffer();
      
      console.log('[thumb][processed]', { traceId, fileId, outputBytes: webpBuffer.length });
    } catch (sharpErr) {
      console.log('[thumb][error]', { traceId, code: 'THUMB_PROCESS_ERROR', error: String(sharpErr) });
      return jsonResponse(500, { ok: false, code: "THUMB_PROCESS_ERROR", details: String(sharpErr), traceId });
    }

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('thumbnails')
      .upload(storagePath, webpBuffer, {
        contentType: 'image/webp',
        upsert: true
      });

    if (uploadError) {
      console.log('[thumb][error]', { traceId, code: 'UPLOAD_FAILED', uploadError });
      return jsonResponse(500, { ok: false, code: "UPLOAD_FAILED", message: uploadError.message, traceId });
    }

    // Generate signed URL
    const { data: signedData, error: signError } = await supabase.storage
      .from('thumbnails')
      .createSignedUrl(storagePath, 3600);

    if (!signedData?.signedUrl) {
      console.log('[thumb][error]', { traceId, code: 'SIGNING_FAILED', signError });
      return jsonResponse(500, { ok: false, code: "SIGNING_FAILED", traceId });
    }

    console.log('[thumb][success]', { traceId, fileId, url: signedData.signedUrl });

    return jsonResponse(200, {
      ok: true,
      url: signedData.signedUrl,
      rev,
      width: size,
      height: size,
      traceId
    });

  } catch (err) {
    console.log('[thumb][error]', { traceId: traceId, code: 'UNEXPECTED_ERROR', error: String(err) });
    return jsonResponse(500, {
      ok: false,
      code: "UNEXPECTED_ERROR",
      message: String(err),
      traceId: traceId
    });
  }
}

function createPlaceholder(size: number, type: string): string {
  const label = type === "video" ? "📹" : "📄";
  return "data:image/svg+xml;base64," + btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect width="100%" height="100%" fill="#f3f4f6"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="48" fill="#9ca3af">
      ${label}
    </text>
  </svg>`);
}

Deno.serve(handler);