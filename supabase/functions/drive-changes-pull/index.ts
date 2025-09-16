import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { listChanges, DriveFile } from "../_shared/drive_client.ts";
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

async function getState(userId: string) {
  const { data, error } = await admin.from("drive_sync_state")
    .select("start_page_token")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.start_page_token) throw new Error("NO_START_PAGE_TOKEN");
  return data.start_page_token as string;
}

async function upsertItem(userId: string, f: DriveFile) {
  const path = null; // se não souber, mantenha null; o path_cached será refrescado no próximo full ou quando resolver parents
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
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const userId = await getUserIdFromJwt(req);
    if (!userId) return new Response(JSON.stringify({ ok: false, reason: "INVALID_JWT" }), { 
      status: 401, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

    const token = await ensureAccessToken(userId);
    let pageToken = await getState(userId);

    let newStart: string | undefined;
    let processed = 0;

    console.log(`Starting delta sync for user ${userId} from page token ${pageToken.slice(0, 10)}...`);

    do {
      const page = await listChanges(pageToken, token);
      
      for (const ch of page.changes || []) {
        const fileId = ch.fileId as string;
        if (ch.removed) {
          await markRemoved(userId, fileId);
          console.log(`Removed file/folder: ${fileId}`);
        } else if (ch.file) {
          const f = ch.file as DriveFile;
          if (f.mimeType === "application/vnd.google-apps.folder") {
            await upsertFolder(userId, f);
          } else {
            await upsertItem(userId, f);
          }
          console.log(`Updated ${f.mimeType === "application/vnd.google-apps.folder" ? "folder" : "file"}: ${f.name}`);
        }
        processed++;
      }
      
      if (page.newStartPageToken) newStart = page.newStartPageToken;
      pageToken = page.nextPageToken || "";
    } while (pageToken);

    if (newStart) {
      const { error } = await admin.from("drive_sync_state")
        .update({ 
          start_page_token: newStart, 
          last_changes_at: new Date().toISOString(), 
          updated_at: new Date().toISOString() 
        })
        .eq("user_id", userId);
      if (error) throw new Error("UPSERT_SYNC:" + error.message);
    }

    console.log(`Delta sync completed: ${processed} changes processed`);

    return new Response(JSON.stringify({ 
      ok: true, 
      processed, 
      newStartPageToken: newStart 
    }), { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
    
  } catch (e: any) {
    console.error("Changes pull error:", e?.message || String(e));
    return new Response(JSON.stringify({ 
      ok: false, 
      reason: "CHANGES_ERROR", 
      message: e?.message || String(e) 
    }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});