import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth, httpJson, safeError } from "../_shared/http.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { ensureAccessToken } from "../_shared/token_provider_v2.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BodySchema = z.object({ budgetFolders: z.number().int().min(1).max(20).optional() });

const isFolder = (mime?: string) => mime === "application/vnd.google-apps.folder";

async function listChildren(token: string, folderId: string, pageToken?: string) {
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("q", `'${folderId}' in parents and trashed=false`);
  url.searchParams.set("fields", "nextPageToken, files(id,name,mimeType,md5Checksum,size,modifiedTime,createdTime,parents,imageMediaMetadata,videoMediaMetadata)");
  if (pageToken) url.searchParams.set("pageToken", pageToken);
  url.searchParams.set("pageSize", "1000");
  url.searchParams.set("supportsAllDrives", "true");
  url.searchParams.set("includeItemsFromAllDrives", "true");

  const r = await fetch(url.toString(), { 
    headers: { Authorization: `Bearer ${token}` } 
  });
  
  if (!r.ok) {
    const body = await r.text();
    console.error(`Google API error ${r.status}:`, body);
    return { ok: false as const, status: r.status };
  }
  
  return { ok: true as const, data: await r.json() };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const cid = crypto.randomUUID();

  try {
    if (req.method !== "POST") throw new Error("METHOD_NOT_ALLOWED");
    
    const { userId } = await requireAuth(req);
    
    await checkRateLimit({
      userId,
      ip: req.headers.get('x-forwarded-for') || 'unknown',
      endpoint: 'drive-sync-run',
      limit: 120,
      windowSec: 300
    });

    const { budgetFolders = 5 } = BodySchema.parse(await req.json().catch(() => ({})));

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Obter token de acesso
    const token = await ensureAccessToken(userId);

    // Read settings to verify root folder
    const { data: settings } = await admin
      .from("user_drive_settings")
      .select("drive_folder_id")
      .eq("user_id", userId)
      .maybeSingle();

    // Carregar estado
    const { data: st, error: stErr } = await admin
      .from("drive_sync_state")
      .select("*")
      .eq("user_id", userId)
      .single();
    
    if (stErr || !st) throw new Error("SYNC_NOT_INITIALIZED");

    // Verify root_folder_id matches settings (block mismatch with clear error)
    console.log(`[sync-run][start]`, {
      traceId: cid,
      user_id: userId,
      settingsFolderId: settings?.drive_folder_id ?? null,
      stateRootFolderId: st.root_folder_id
    });
    
    if (settings?.drive_folder_id && st.root_folder_id !== settings.drive_folder_id) {
      console.error(`[sync-run][ROOT_MISMATCH]`, {
        traceId: cid,
        user_id: userId,
        stateRoot: st.root_folder_id,
        settingsRoot: settings.drive_folder_id
      });
      return httpJson(409, { 
        ok: false, 
        code: 'ROOT_MISMATCH',
        message: 'Pasta alterada. Clique em Sincronizar novamente para rearmar o root.',
        stateRoot: st.root_folder_id,
        settingsRoot: settings.drive_folder_id,
        traceId: cid
      }, req.headers.get('origin'));
    }

    let pending: string[] = Array.isArray(st.pending_folders) ? st.pending_folders.slice() : [];
    
    if (!pending.length) {
      await admin
        .from("drive_sync_state")
        .update({ 
          status: 'idle', 
          last_sync_at: new Date().toISOString(), 
          updated_at: new Date().toISOString() 
        })
        .eq("user_id", userId);
      
      console.log(`Sync completed for user ${userId}`);
      return httpJson(200, { ok: true, done: true, queued: 0, processedFolders: 0 }, req.headers.get('origin'));
    }

    let processedFolders = 0;
    let updatedItems = 0;
    let foundFolders = 0;

    // Marcar como running
    await admin
      .from("drive_sync_state")
      .update({ status: 'running', updated_at: new Date().toISOString() })
      .eq("user_id", userId);

    while (pending.length && processedFolders < budgetFolders) {
      const folderId = pending.shift()!;
      let pageToken: string | undefined;

      console.log(`Processing folder ${folderId} (${processedFolders + 1}/${budgetFolders})`);

      do {
        const res = await listChildren(token, folderId, pageToken);
        if (!res.ok) {
          console.error(`Failed to list children for folder ${folderId}: ${res.status}`);
          throw new Error(`GOOGLE_LIST_FAILED_${res.status}`);
        }

        const files = res.data.files ?? [];
        
        for (const f of files) {
          if (isFolder(f.mimeType)) {
            pending.push(f.id);
            foundFolders++;
          } else {
            // Determinar media_kind
            let media_kind = null;
            if (f.mimeType?.startsWith("video/")) {
              media_kind = "video";
            } else if (f.mimeType?.startsWith("image/")) {
              media_kind = "photo";
            }

            // Extrair data original de imageMediaMetadata ou videoMediaMetadata
            let original_taken_at = null;
            if (f.imageMediaMetadata?.time) {
              original_taken_at = new Date(f.imageMediaMetadata.time).toISOString();
            } else if (f.videoMediaMetadata?.creationTime) {
              original_taken_at = new Date(f.videoMediaMetadata.creationTime).toISOString();
            }

            // Converter size para string (seguro para BIGINT do Postgres)
            const sizeStr = typeof f.size === "string" ? f.size :
                            typeof f.size === "number" ? String(f.size) :
                            f.size != null ? String(f.size) : null;

            const { error: upErr } = await admin
              .from("drive_items")
              .upsert({
                user_id: userId,
                file_id: f.id,
                name: f.name,
                parent_id: folderId,
                mime_type: f.mimeType ?? null,
                md5_checksum: f.md5Checksum ?? null,
                size: f.size ? Number(f.size) : null,
                size_bigint: sizeStr,
                modified_time: f.modifiedTime ? new Date(f.modifiedTime).toISOString() : null,
                created_time: f.createdTime ? new Date(f.createdTime).toISOString() : null,
                media_kind,
                original_taken_at,
                image_meta: f.imageMediaMetadata ?? null,
                video_meta: f.videoMediaMetadata ?? null,
                parents: f.parents ?? null,
                status: 'active',
                last_seen_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }, { onConflict: "user_id,file_id" });

            if (!upErr) {
              updatedItems++;
            } else {
              console.error(`Failed to upsert item ${f.id}:`, upErr);
            }
          }
        }

        pageToken = res.data.nextPageToken ?? undefined;
      } while (pageToken);

      processedFolders++;
    }

    // Atualizar estado
    const currentStats = st.stats || {};
    const newStats = {
      updatedItems: (currentStats.updatedItems || 0) + updatedItems,
      processedFolders: (currentStats.processedFolders || 0) + processedFolders,
      foundFolders: (currentStats.foundFolders || 0) + foundFolders
    };

    const { error: stUpErr } = await admin
      .from("drive_sync_state")
      .update({
        pending_folders: pending,
        status: pending.length ? 'running' : 'idle',
        stats: newStats,
        last_sync_at: pending.length ? st.last_sync_at : new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("user_id", userId);
    
    if (stUpErr) throw stUpErr;

    console.log(`Processed ${processedFolders} folders, ${updatedItems} items, ${foundFolders} subfolders found. Remaining: ${pending.length}`);

    return httpJson(200, { 
      ok: true, 
      done: pending.length === 0, 
      queued: pending.length, 
      processedFolders,
      updatedItems,
      foundFolders,
      traceId: cid
    }, req.headers.get('origin'));
    
  } catch (err: any) {
    const errMsg = String(err?.message ?? err);
    console.error("[SYNC_RUN_ERROR]", { 
      cid, 
      userId: err?.userId,
      error: errMsg,
      timestamp: new Date().toISOString() 
    });
    
    const publicMap: Record<string, { msg: string; hint: string }> = {
      METHOD_NOT_ALLOWED: { msg: "Método não permitido (METHOD)", hint: "Use POST" },
      VALIDATION_FAILED: { msg: "Dados inválidos (BAD_BODY)", hint: "Verifique os parâmetros" },
      RATE_LIMITED: { msg: "Limite de requisições atingido (RL)", hint: "Aguarde alguns minutos" },
      DRIVE_NOT_CONNECTED: { msg: "Google Drive não conectado (NO_DRIVE)", hint: "Conecte sua conta primeiro" },
      SYNC_NOT_INITIALIZED: { msg: "Sincronização não inicializada (NO_STATE)", hint: "Selecione uma pasta primeiro" },
    };
    
    const mapped = publicMap[errMsg] ?? { msg: `Falha na sincronização (SYNC_FAIL)`, hint: "Tente novamente" };
    return safeError(err, { 
      publicMessage: mapped.msg,
      hint: mapped.hint,
      logContext: `[${cid}]`
    });
  }
});