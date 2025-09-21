import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, preflight } from "../_shared/cors.ts";

serve(async (req) => {
  const preflightResponse = preflight(req);
  if (preflightResponse) return preflightResponse;

  try {
    const { page = 1, pageSize = 20, source = "all", mimeClass = "all", labelIds = [], q = "" } = await req.json();

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user ID from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders(req.headers.get("origin")), 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders(req.headers.get("origin")), 'Content-Type': 'application/json' }
      });
    }

    const userId = userData.user.id;
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
      let driveQuery = supabase
        .from('drive_items')
        .select('*')
        .eq('user_id', userId)
        .eq('trashed', false);

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

    // Apply pagination
    const total = items.length;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedItems = items.slice(startIndex, endIndex);

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

    // Get thumbnail URLs for Google Drive items that don't have posterUrl
    const missingIds = paginatedItems
      .filter(item => item.source === 'gdrive' && !item.posterUrl)
      .map(item => item.id.split(':')[1])
      .filter(Boolean);

    if (missingIds.length > 0) {
      try {
        const { data, error } = await supabase.functions.invoke("get-thumb-urls", {
          body: { fileIds: missingIds }
        });
        
        if (!error && data?.urls) {
          const urlMap = data.urls;
          // Assign posterUrl to each GDrive item
          for (const item of paginatedItems) {
            if (item.source === 'gdrive') {
              const fileId = item.id.split(':')[1];
              if (fileId && urlMap[fileId]) {
                item.posterUrl = urlMap[fileId];
              }
            }
          }
        }
      } catch (error) {
        console.error('Error fetching thumbnails:', error);
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

    return new Response(JSON.stringify({
      items: responseItems,
      total,
      page,
      pageSize
    }), {
      headers: { ...corsHeaders(req.headers.get("origin")), 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in library-list-unified:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders(req.headers.get("origin")), 'Content-Type': 'application/json' }
    });
  }
});