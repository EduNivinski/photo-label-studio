import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { listChildren, DriveFile, getStartPageToken } from "../_shared/drive_client.ts";
import { ensureAccessToken } from "../_shared/token_provider_v2.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

async function getSettings(userId: string) {
  const { data, error } = await admin.from("user_drive_settings")
    .select("drive_folder_id, drive_folder_name, drive_folder_path")
    .eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.drive_folder_id) throw new Error("NO_FOLDER_SELECTED");
  return data;
}

async function upsertFolder(userId: string, id: string, name: string, parentId: string | null, path: string) {
  const { error } = await admin.from("drive_folders").upsert({
    user_id: userId, 
    folder_id: id, 
    name, 
    parent_id: parentId, 
    path_cached: path, 
    trashed: false, 
    updated_at: new Date().toISOString()
  }, { onConflict: "user_id,folder_id" });
  if (error) throw new Error("UPSERT_FOLDER:" + error.message);
}

async function upsertItem(userId: string, f: DriveFile, path: string) {
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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validar JWT
    const userId = await getUserIdFromJwt(req);
    if (!userId) return new Response(JSON.stringify({ ok: false, reason: "INVALID_JWT" }), { 
      status: 401, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

    const traceId = crypto.randomUUID();
    const token = await ensureAccessToken(userId);
    const settings = await getSettings(userId);

    console.log(`[drive-index-folder][start]`, {
      traceId,
      user_id: userId,
      settingsFolderId: settings.drive_folder_id,
      folderName: settings.drive_folder_name,
      folderPath: settings.drive_folder_path
    });

    // BFS iterativa
    const queue: { id: string; name: string; path: string }[] = [{ 
      id: settings.drive_folder_id, 
      name: settings.drive_folder_name || "Pasta", 
      path: settings.drive_folder_path || "Meu Drive" 
    }];
    
    await upsertFolder(userId, settings.drive_folder_id, settings.drive_folder_name || "Pasta", null, settings.drive_folder_path || "Meu Drive");

    let totalFiles = 0;
    let totalFolders = 1;

    while (queue.length) {
      const cur = queue.shift()!;
      let pageToken: string | undefined = undefined;
      
      do {
        const page = await listChildren(cur.id, token, pageToken);
        
        for (const f of page.files) {
          if (f.mimeType === "application/vnd.google-apps.folder") {
            const nextPath = `${cur.path} / ${f.name}`;
            await upsertFolder(userId, f.id, f.name, cur.id, nextPath);
            queue.push({ id: f.id, name: f.name, path: nextPath });
            totalFolders++;
          } else {
            const p = `${cur.path} / ${f.name}`;
            await upsertItem(userId, f, p);
            totalFiles++;
          }
        }
        pageToken = page.nextPageToken;
      } while (pageToken);
    }

    // Salvar startPageToken inicial
    const spt = await getStartPageToken(token);
    const { error: upSync } = await admin.from("drive_sync_state").upsert({
      user_id: userId, 
      start_page_token: spt.startPageToken, 
      last_full_scan_at: new Date().toISOString(), 
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id" });
    
    if (upSync) throw new Error("UPSERT_SYNC:" + upSync.message);

    console.log(`Full scan completed: ${totalFiles} files, ${totalFolders} folders`);

    return new Response(JSON.stringify({ 
      ok: true, 
      totalFiles, 
      totalFolders, 
      startPageToken: spt.startPageToken,
      traceId
    }), { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } 
    });
    
  } catch (e: any) {
    console.error("Index folder error:", e?.message || String(e));
    return new Response(JSON.stringify({ 
      ok: false, 
      reason: "INDEX_ERROR", 
      message: e?.message || String(e) 
    }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});