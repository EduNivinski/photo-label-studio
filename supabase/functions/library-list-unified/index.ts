import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { requireAuth, httpJson, safeError, getClientIp } from "../_shared/http.ts";
import { checkRateLimit, RATE_LIMITS } from "../_shared/rate-limit.ts";
import { LibraryListUnifiedSchema, validateBody } from "../_shared/validation.ts";

serve(async (req) => {
  const preflightResponse = preflight(req);
  if (preflightResponse) return preflightResponse;

  try {
    // Authenticate user
    const { userId } = await requireAuth(req);
    const authHeader = req.headers.get('authorization') || '';
    
    // Rate limiting
    const clientIp = getClientIp(req);
    const canProceed = await checkRateLimit({
      userId,
      ip: clientIp,
      endpoint: "library-list-unified",
      limit: RATE_LIMITS["library-list-unified"].limit,
      windowSec: RATE_LIMITS["library-list-unified"].windowSec,
    });

    if (!canProceed) {
      return httpJson(429, { ok: false, error: "Rate limit exceeded. Please try again later." });
    }

    // Validate input
    const body = await req.json().catch(() => ({}));
    const { page, pageSize, source, mimeClass, labelIds, q } = validateBody(LibraryListUnifiedSchema, body);

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const items: any[] = [];

    // Get items from database
    if (source === "all" || source === "db") {
      let dbQuery = supabase
        .from('photos')
        .select('*')
        .eq('user_id', userId);

      // Apply mime type filter
      if (mimeClass === "image") {
        dbQuery = dbQuery.eq('media_type', 'photo');
      } else if (mimeClass === "video") {
        dbQuery = dbQuery.eq('media_type', 'video');
      }

      // Apply search filter
      if (q) {
        dbQuery = dbQuery.ilike('name', `%${q}%`);
      }

      // Apply label filter
      if (labelIds.length > 0) {
        dbQuery = dbQuery.overlaps('labels', labelIds);
      }

      const { data: dbItems, error: dbError } = await dbQuery;
      
      if (dbError) {
        console.error('Database query error:', dbError);
      } else if (dbItems) {
        items.push(...dbItems.map(item => ({
          ...item,
          source: 'db',
          id: `db:${item.id}`,
          item_key: item.id,
          mime_type: item.media_type === 'video' ? 'video/mp4' : 'image/jpeg',
          created_time: item.upload_date,
          modified_time: item.updated_at || item.upload_date
        })));
      }
    }

// Get items from Google Drive
if (source === "all" || source === "gdrive") {
  // Read current root folder id to enforce single-root listing
  const { data: syncState } = await supabase
    .from('drive_sync_state')
    .select('root_folder_id')
    .eq('user_id', userId)
    .maybeSingle();

  let driveQuery = supabase
    .from('drive_items')
    .select('*')
    .eq('user_id', userId)
    .eq('trashed', false)
    .neq('status', 'deleted'); // Filter out deleted items

  // Restrict to current root if available (items whose parents include root)
  if (syncState?.root_folder_id) {
    driveQuery = driveQuery.contains('parents', [syncState.root_folder_id]);
  }

  // Apply mime type filter
  if (mimeClass === "image") {
    driveQuery = driveQuery.like('mime_type', 'image/%');
  } else if (mimeClass === "video") {
    driveQuery = driveQuery.like('mime_type', 'video/%');
  }

  // Apply search filter
  if (q) {
    driveQuery = driveQuery.ilike('name', `%${q}%`);
  }

  const { data: driveItems, error: driveError } = await driveQuery;
  
  if (driveError) {
    console.error('Drive query error:', driveError);
  } else if (driveItems) {
    items.push(...driveItems.map(item => ({
      ...item,
      source: 'gdrive',
      id: `gdrive:${item.file_id}`,
      item_key: item.file_id
    })));
  }
}

    // Sort items by modified time (newest first)
    items.sort((a, b) => {
      const dateA = new Date(a.modified_time || a.created_time || 0);
      const dateB = new Date(b.modified_time || b.created_time || 0);
      return dateB.getTime() - dateA.getTime();
    });

    // Apply pagination FIRST
    const total = items.length;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedItems = items.slice(startIndex, endIndex);

    // Ensure thumbnails for Google Drive items
    let debugFilledThumbs = 0;
    let needsDriveReauth = false;
    
    for (const item of paginatedItems) {
      if (item.source === "gdrive") {
        const fileId = item.file_id;
        const mimeType = item.mime_type || '';
        
        // Only process images and videos
        const isMedia = mimeType.startsWith('image/') || mimeType.startsWith('video/');
        if (!isMedia) {
          continue;
        }
        
        // Calculate current revision (sha1 of fileId:modified_time)
        const revInput = `${fileId}:${item.modified_time || ''}`;
        const revHashBuffer = await crypto.subtle.digest(
          'SHA-1', 
          new TextEncoder().encode(revInput)
        );
        const currentRev = Array.from(new Uint8Array(revHashBuffer))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('')
          .substring(0, 16);

        // Check if we need to generate/fetch new thumbnail
        const needsThumb = !item.thumb_url || item.thumb_rev !== currentRev;

        if (needsThumb) {
          try {
            // Call drive-thumb-fetch to generate thumbnail (size=256 for cards)
            const thumbUrl = `${supabaseUrl}/functions/v1/drive-thumb-fetch?itemId=${fileId}&size=256`;
            const thumbResp = await fetch(thumbUrl, {
              headers: {
                'Authorization': authHeader
              }
            });

            if (thumbResp.ok) {
              const thumbData = await thumbResp.json();
              if (thumbData.ok && thumbData.url && !thumbData.url.startsWith('data:')) {
                // Only use HTTP/HTTPS URLs, not data: placeholders
                item.posterUrl = thumbData.url;
                debugFilledThumbs++;
                
                // Update drive_items with new thumb_url
                await supabase
                  .from('drive_items')
                  .update({ 
                    thumb_url: thumbData.url,
                    thumb_rev: currentRev,
                    thumb_updated_at: new Date().toISOString()
                  })
                  .eq('user_id', userId)
                  .eq('file_id', fileId);
                
                console.log(`✅ Generated and cached thumb for ${fileId}`);
              } else {
                console.log(`⚠️ Skipped placeholder/invalid thumb for ${fileId}`);
              }
            } else {
              let errJson: any = null;
              try { errJson = await thumbResp.json(); } catch {}
              
              // Only set needsDriveReauth for actual scope issues, not file permission issues
              if (thumbResp.status === 403 && errJson && errJson.code === 'INSUFFICIENT_SCOPE') {
                needsDriveReauth = true;
                console.log(`🔒 Insufficient scope for ${fileId}`);
              } else if (thumbResp.status === 403 && errJson && errJson.code === 'FORBIDDEN_FILE') {
                console.log(`🚫 File permission denied for ${fileId} (not a scope issue)`);
              } else if (thumbResp.status === 404) {
                console.log(`📭 No thumbnail available for ${fileId}`);
              } else {
                console.log(`⚠️ Thumb fetch failed for ${fileId}: ${thumbResp.status} ${errJson?.code || ''}`);
              }
            }
          } catch (thumbError) {
            console.error(`❌ Error fetching thumb for ${fileId}:`, thumbError);
          }
        } else if (item.thumb_url && !item.thumb_url.startsWith('data:')) {
          // Use cached thumbnail URL (only if it's HTTP/HTTPS)
          item.posterUrl = item.thumb_url;
          debugFilledThumbs++;
        }
      }
    }

    console.log(`📊 Processing ${paginatedItems.length} paginated items, ${debugFilledThumbs} thumbnails filled`);

    // Get labels for all items
    const itemKeys = paginatedItems.map(item => ({
      source: item.source,
      item_key: item.source === 'db' ? item.id.replace('db:', '') : item.file_id
    }));

    // Build label query conditions
    let itemLabels: Record<string, any[]> = {};
    if (itemKeys.length > 0) {
      try {
        // Query labels for all items
        let labelQuery = supabase
          .from('labels_items')
          .select(`
            source,
            item_key,
            labels:label_id (
              id,
              name,
              color
            )
          `);

        // Build OR conditions for each item
        const orConditions = itemKeys.map(({ source, item_key }) => 
          `(source.eq.${source},item_key.eq.${item_key})`
        );

        if (orConditions.length > 0) {
          labelQuery = labelQuery.or(orConditions.join(','));
        }

        const { data: labelsData, error: labelsError } = await labelQuery;

        if (!labelsError && labelsData) {
          // Group labels by item
          labelsData.forEach(labelItem => {
            const key = `${labelItem.source}:${labelItem.item_key}`;
            if (!itemLabels[key]) itemLabels[key] = [];
            if (labelItem.labels) {
              itemLabels[key].push(labelItem.labels);
            }
          });
        }
      } catch (error) {
        console.error('Error fetching labels:', error);
      }
    }

    // Format response items
    const responseItems = paginatedItems.map(item => {
      const isVideo = (item.mime_type || '').startsWith('video/');
      const posterUrl = item.source === 'gdrive' ? item.posterUrl : item.url;
      const itemKey = item.source === 'db' ? item.id.replace('db:', '') : item.file_id;
      const labelsKey = `${item.source}:${itemKey}`;
      const labels = itemLabels[labelsKey] || [];
      
      return {
        id: item.id,
        source: item.source,
        name: item.name,
        mimeType: item.mime_type,
        isVideo,
        width: item.video_width || item.width || null,
        height: item.video_height || item.height || null,
        durationMs: item.video_duration_ms || null,
        createdAt: item.created_time || item.upload_date,
        updatedAt: item.modified_time || item.updated_at,
        posterUrl,
        thumbUrl: posterUrl,
        previewUrl: item.source === 'db' ? item.url : null,
        openInDriveUrl: item.source === 'gdrive' ? (item.web_view_link || `https://drive.google.com/file/d/${item.file_id}/view`) : null,
        downloadEnabled: true,
        labels: labels.map(label => ({
          id: label.id,
          name: label.name,
          color: label.color
        }))
      };
    });

    const finalDebugFilled = responseItems.filter(it => it.source==="gdrive" && !!it.posterUrl).length;
    const finalDebugMissing = responseItems.filter(it => it.source==="gdrive" && !it.posterUrl).length;

    console.log('📋 Response summary:', {
      itemsReturned: responseItems.length,
      total,
      page,
      pageSize,
      gdriveWithPoster: finalDebugFilled,
      gdriveWithoutPoster: finalDebugMissing
    });

    return new Response(JSON.stringify({
      items: responseItems,
      total,
      page,
      pageSize,
      debugFilledThumbs: finalDebugFilled,
      debugMissingThumbs: finalDebugMissing,
      needsDriveReauth,
    }), {
      headers: { 
        ...corsHeaders(req.headers.get("origin")), 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Vary': 'Origin',
        'Access-Control-Allow-Origin': 'https://photo-label-studio.lovable.app',
        'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, cache-control',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      }
    });

  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return httpJson(401, { ok: false, error: "Unauthorized." });
    }
    if (error?.message === "VALIDATION_FAILED") {
      return httpJson(400, { ok: false, error: "Invalid request data." });
    }
    return safeError(error, { 
      publicMessage: "Unable to load library.", 
      logContext: "library-list-unified" 
    });
  }
});