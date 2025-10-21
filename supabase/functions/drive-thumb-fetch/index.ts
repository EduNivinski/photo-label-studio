import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/http.ts";
import { getDriveClient, driveFetchJSON } from "../_shared/drive_client.ts";

// @deno-types="npm:@types/sharp@^0.32.0"
import sharp from "npm:sharp@^0.33.0";

async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const traceId = crypto.randomUUID();

  try {
    // Parse input
    let itemId: string | undefined;
    let size = 256;
    let userId: string | undefined;

    if (req.method === "GET") {
      const url = new URL(req.url);
      itemId = url.searchParams.get("itemId") ?? undefined;
      size = parseInt(url.searchParams.get("size") ?? "256", 10);
    } else if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      itemId = body.itemId;
      size = parseInt(String(body.size ?? "256"), 10);
    } else {
      return json(405, { ok: false, code: "METHOD_NOT_ALLOWED" });
    }

    if (!itemId) {
      return json(400, { ok: false, code: "MISSING_ITEM_ID", message: "itemId é obrigatório", traceId });
    }

    // Normalize prefix
    const fileId = String(itemId).replace(/^gdrive:/, "");

    // Get user from auth header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return json(401, { ok: false, code: "UNAUTHORIZED", traceId });
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
      return json(401, { ok: false, code: "UNAUTHORIZED", traceId });
    }
    
    userId = user.id;

    // Get drive item metadata
    const { data: driveItem } = await supabase
      .from('drive_items')
      .select('file_id, mime_type, modified_time, md5_checksum, updated_at, thumbnail_link')
      .eq('user_id', userId)
      .eq('file_id', fileId)
      .maybeSingle();

    if (!driveItem) {
      return json(404, { ok: false, code: "FILE_NOT_FOUND", traceId });
    }

    const mimeType = driveItem.mime_type || '';
    
    // Calculate revision hash
    const revInput = `${driveItem.modified_time || ''}|${driveItem.md5_checksum || ''}|${driveItem.updated_at || ''}`;
    const revHashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(revInput));
    const rev = Array.from(new Uint8Array(revHashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .substring(0, 16);

    // Check cache in storage
    const storagePath = `${userId}/${fileId}/${rev}/${size}.webp`;
    
    const { data: existingFile } = await supabase.storage
      .from('thumbnails')
      .list(storagePath.split('/').slice(0, -1).join('/'), {
        search: `${size}.webp`
      });

    if (existingFile && existingFile.length > 0) {
      // Cache hit - return signed URL
      const { data: signedData } = await supabase.storage
        .from('thumbnails')
        .createSignedUrl(storagePath, 3600); // 1 hour

      if (signedData?.signedUrl) {
        console.log(`✅ Cache hit for ${fileId}`);
        return json(200, {
          ok: true,
          url: signedData.signedUrl,
          rev,
          width: size,
          height: size,
          traceId
        });
      }
    }

    // Cache miss - generate thumbnail
    console.log(`🔄 Generating thumbnail for ${fileId} (${mimeType})`);

    // Get Drive access token
    const driveClient = await getDriveClient(userId, supabase);
    if (!driveClient) {
      return json(401, { ok: false, code: "DRIVE_TOKEN_MISSING", traceId });
    }

    let imageBuffer: ArrayBuffer;

    // Handle different mime types
    if (mimeType.startsWith('image/')) {
      // Download image from Drive
      const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`;
      const response = await fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${driveClient.token}` }
      });

      if (!response.ok) {
        console.error(`Failed to download image: ${response.status}`);
        return json(500, { ok: false, code: "DOWNLOAD_FAILED", traceId });
      }

      imageBuffer = await response.arrayBuffer();
    } else if (mimeType.startsWith('video/')) {
      // Use Drive's thumbnail for videos
      if (driveItem.thumbnail_link) {
        const thumbResponse = await fetch(driveItem.thumbnail_link, {
          headers: { Authorization: `Bearer ${driveClient.token}` }
        });

        if (thumbResponse.ok) {
          imageBuffer = await thumbResponse.arrayBuffer();
        } else {
          // Fallback to placeholder
          return json(200, {
            ok: true,
            url: createPlaceholder(size, "video"),
            rev,
            width: size,
            height: size,
            traceId
          });
        }
      } else {
        return json(200, {
          ok: true,
          url: createPlaceholder(size, "video"),
          rev,
          width: size,
          height: size,
          traceId
        });
      }
    } else {
      // Other types - return placeholder
      return json(200, {
        ok: true,
        url: createPlaceholder(size, "file"),
        rev,
        width: size,
        height: size,
        traceId
      });
    }

    // Process with sharp
    const webpBuffer = await sharp(Buffer.from(imageBuffer))
      .resize({
        width: size,
        height: size,
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: 82 })
      .toBuffer();

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('thumbnails')
      .upload(storagePath, webpBuffer, {
        contentType: 'image/webp',
        upsert: true
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return json(500, { ok: false, code: "UPLOAD_FAILED", message: uploadError.message, traceId });
    }

    // Generate signed URL
    const { data: signedData } = await supabase.storage
      .from('thumbnails')
      .createSignedUrl(storagePath, 3600);

    if (!signedData?.signedUrl) {
      return json(500, { ok: false, code: "SIGNING_FAILED", traceId });
    }

    console.log(`✅ Generated and uploaded thumbnail for ${fileId}`);

    return json(200, {
      ok: true,
      url: signedData.signedUrl,
      rev,
      width: size,
      height: size,
      traceId
    });

  } catch (err) {
    console.error("[drive-thumb-fetch][error]", err);
    return json(500, {
      ok: false,
      code: "UNEXPECTED_ERROR",
      message: String(err),
      traceId
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