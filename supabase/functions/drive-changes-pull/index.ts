import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { listChanges, getStartPageToken, DriveFile } from "../_shared/drive_client.ts";
import { ensureAccessToken } from "../_shared/token_provider_v2.ts";
import { corsHeaders } from "../_shared/http.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

async function getUserIdFromJwt(req: Request): Promise<string | null> {
  try {
    const auth = req.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) return null;
    const token = auth.slice("Bearer ".length);
    const adminClient = admin;
    const { data: { user } } = await adminClient.auth.getUser(token);
    return user?.id ?? null;
  } catch {
    return null;
  }
}

async function getState(userId: string) {
  const { data, error } = await admin.from("drive_sync_state")
    .select("start_page_token, root_folder_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { 
    startPageToken: data?.start_page_token || null, 
    rootFolderId: data?.root_folder_id || null 
  };
}

async function saveStartPageToken(userId: string, token: string) {
  const { error } = await admin.from("drive_sync_state")
    .update({ start_page_token: token })
    .eq("user_id", userId);
  if (error) throw new Error(`Failed to save token: ${error.message}`);
}

async function upsertItem(userId: string, f: DriveFile) {
  const path = null; // se não souber, mantenha null; o path_cached será refrescado no próximo full ou quando resolver parents
  
  // Extract video metadata if present
  const videoMeta = f.videoMediaMetadata;
  const videoDurationMs = videoMeta?.durationMillis ? Number(videoMeta.durationMillis) : null;
  const videoWidth = videoMeta?.width ? Number(videoMeta.width) : null;
  const videoHeight = videoMeta?.height ? Number(videoMeta.height) : null;

  const { error } = await admin.from("drive_items").upsert({
    user_id: userId, 
    file_id: f.id, 
    name: f.name, 
    mime_type: f.mimeType,
    size: f.size ? Number(f.size) : null, 
    md5_checksum: f.md5Checksum || null,
    created_time: f.createdTime || null, 
    modified_time: f.modifiedTime || null,
    drive_id: f.driveId || null, 
    parents: f.parents || null,
    trashed: !!f.trashed, 
    web_view_link: f.webViewLink || null,
    web_content_link: f.webContentLink || null, 
    thumbnail_link: f.thumbnailLink || null,
    image_meta: f.imageMediaMetadata || null, 
    video_meta: f.videoMediaMetadata || null,
    video_duration_ms: videoDurationMs,
    video_width: videoWidth,
    video_height: videoHeight,
    path_cached: path, 
    last_seen_at: new Date().toISOString(),
    status: f.trashed ? "deleted" : "active", 
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,file_id" });
  if (error) throw new Error("UPSERT_ITEM:" + error.message);
}

async function upsertFolder(userId: string, f: DriveFile) {
  const path = null; // path será resolvido posteriormente
  const { error } = await admin.from("drive_folders").upsert({
    user_id: userId,
    folder_id: f.id,
    name: f.name,
    parent_id: f.parents?.[0] || null,
    path_cached: path,
    trashed: !!f.trashed,
    updated_at: new Date().toISOString()
  }, { onConflict: "user_id,folder_id" });
  if (error) throw new Error("UPSERT_FOLDER:" + error.message);
}

async function markRemoved(userId: string, fileId: string) {
  // Marca tanto em drive_items quanto drive_folders
  const { error: itemErr } = await admin.from("drive_items")
    .update({ status: "deleted", trashed: true, updated_at: new Date().toISOString() })
    .eq("user_id", userId).eq("file_id", fileId);
  
  const { error: folderErr } = await admin.from("drive_folders")
    .update({ trashed: true, updated_at: new Date().toISOString() })
    .eq("user_id", userId).eq("folder_id", fileId);
  
  // Log erros mas não falha se não encontrar o item
  if (itemErr) console.warn("MARK_ITEM_REMOVED:", itemErr.message);
  if (folderErr) console.warn("MARK_FOLDER_REMOVED:", folderErr.message);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const traceId = crypto.randomUUID();

  try {
    const userId = await getUserIdFromJwt(req);
    if (!userId) {
      return new Response(JSON.stringify({ 
        ok: false, 
        code: "INVALID_JWT",
        message: "Authentication required",
        traceId 
      }), { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const token = await ensureAccessToken(userId);
    const state = await getState(userId);

    console.log('[changes-pull][start]', { 
      traceId, 
      user_id: userId, 
      hasToken: !!state.startPageToken, 
      rootFolderId: state.rootFolderId 
    });

    // If no token exists, initialize one
    if (!state.startPageToken) {
      console.log('[changes-pull][resetToken]', { traceId, reason: 'NO_TOKEN' });
      const { startPageToken } = await getStartPageToken(token);
      await saveStartPageToken(userId, startPageToken);
      
      return new Response(JSON.stringify({ 
        ok: true, 
        processed: 0,
        newStartPageToken: startPageToken,
        reset: true,
        message: 'Initialized change token',
        traceId 
      }), { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    let pageToken = state.startPageToken;
    let newStartPageToken: string | undefined;
    let processed = 0;

    // Apply changes to database with error handling
    do {
      try {
        const page = await listChanges(pageToken, token);
        
        for (const ch of page.changes || []) {
          const fileId = ch.fileId as string;
          if (ch.removed) {
            await markRemoved(userId, fileId);
          } else if (ch.file) {
            const f = ch.file as DriveFile;
            if (f.mimeType === "application/vnd.google-apps.folder") {
              await upsertFolder(userId, f);
            } else {
              await upsertItem(userId, f);
            }
          }
          processed++;
        }
        
        if (page.newStartPageToken) newStartPageToken = page.newStartPageToken;
        pageToken = page.nextPageToken || "";
      } catch (apiError: any) {
        // Handle invalid token - reset and retry
        if (apiError?.message?.includes('invalid') || apiError?.message?.includes('startPageToken')) {
          console.log('[changes-pull][resetToken]', { traceId, reason: 'INVALID_TOKEN', error: apiError.message });
          const { startPageToken } = await getStartPageToken(token);
          await saveStartPageToken(userId, startPageToken);
          
          return new Response(JSON.stringify({ 
            ok: true, 
            processed,
            newStartPageToken: startPageToken,
            reset: true,
            message: 'Token reset due to invalidity',
            traceId 
          }), { 
            status: 200, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          });
        }
        
        // Handle insufficient scope
        if (apiError?.message?.includes('403') || apiError?.message?.includes('insufficient')) {
          return new Response(JSON.stringify({ 
            ok: false, 
            code: "INSUFFICIENT_SCOPE",
            message: "Google Drive API access requires additional permissions",
            traceId 
          }), { 
            status: 403, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          });
        }
        
        throw apiError;
      }
    } while (pageToken);

    // Save the new start page token for future delta syncs
    if (newStartPageToken) {
      await saveStartPageToken(userId, newStartPageToken);
    }

    console.log('[changes-pull][done]', { traceId, processed, newStartPageToken });

    return new Response(JSON.stringify({ 
      ok: true, 
      processed,
      newStartPageToken,
      traceId 
    }), { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
    
  } catch (e: any) {
    console.error('[changes-pull][error]', { traceId, error: e?.message || String(e) });
    return new Response(JSON.stringify({ 
      ok: false, 
      code: "PULL_ERROR",
      message: e?.message || "Failed to pull changes",
      traceId 
    }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});