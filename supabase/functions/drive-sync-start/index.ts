import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth, httpJson, safeError } from "../_shared/http.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BodySchema = z.object({ force: z.boolean().optional() });

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
      endpoint: 'drive-sync-start',
      limit: 10,
      windowSec: 3600
    });

    const body = BodySchema.parse(await req.json().catch(() => ({})));

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1) Read current folder from settings (source of truth)
    const { data: settings, error: settingsErr } = await admin
      .from("user_drive_settings")
      .select("drive_folder_id, drive_folder_name, drive_folder_path")
      .eq("user_id", userId)
      .maybeSingle();
    
    if (settingsErr || !settings?.drive_folder_id) {
      throw new Error("NO_ROOT_FOLDER");
    }

    const currentFolderId = settings.drive_folder_id;

    // 2) Read current sync state
    const { data: state } = await admin
      .from("drive_sync_state")
      .select("root_folder_id, pending_folders, status, start_page_token")
      .eq("user_id", userId)
      .maybeSingle();

    // 3) ALWAYS re-arm state with current folder (unconditional reset)
    console.log(`[sync-start][before]`, {
      user_id: userId,
      settingsFolderId: currentFolderId,
      stateRootBefore: state?.root_folder_id ?? null
    });
    
    const pending = [currentFolderId];
    const upsertData = {
      user_id: userId,
      root_folder_id: currentFolderId,
      pending_folders: pending,
      status: 'idle',
      last_error: null,
      start_page_token: null, // Reset token when re-arming
      last_full_scan_at: null,
      last_changes_at: null,
      stats: {},
      updated_at: new Date().toISOString()
    };

    const { error: upErr } = await admin
      .from("drive_sync_state")
      .upsert(upsertData, { onConflict: "user_id" });
    
    if (upErr) throw upErr;
    
    console.log(`[sync-start][after]`, {
      user_id: userId,
      effectiveRootFolderId: currentFolderId,
      rearmed: true
    });

    return httpJson(200, {
      ok: true, 
      effectiveRootFolderId: currentFolderId,
      message: 'Sync start armed with latest folder',
      cid 
    }, req.headers.get('origin'));
  } catch (err: any) {
    console.error("[SYNC_ERROR]", { cid, fn: "drive-sync-start", msg: String(err?.message ?? err) });
    
    const publicMap: Record<string, string> = {
      METHOD_NOT_ALLOWED: "METHOD",
      VALIDATION_FAILED: "BAD_BODY",
      RATE_LIMITED: "RL",
      NO_ROOT_FOLDER: "NO_FOLDER",
    };
    
    const code = publicMap[String(err?.message)] ?? "START_FAIL";
    return safeError(err, { 
      publicMessage: `Não foi possível iniciar a sincronização (${code})`,
      logContext: `[${cid}]`
    });
  }
});