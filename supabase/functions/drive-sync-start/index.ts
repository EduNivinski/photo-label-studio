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

    // Buscar pasta dedicada
    const { data: settings, error: settingsErr } = await admin
      .from("user_drive_settings")
      .select("drive_folder_id")
      .eq("user_id", userId)
      .single();
    
    if (settingsErr || !settings?.drive_folder_id) {
      throw new Error("NO_ROOT_FOLDER");
    }

    const rootFolderId = settings.drive_folder_id;

    // Iniciar/reiniciar estado
    const pending = [rootFolderId];
    const upsertData = {
      user_id: userId,
      root_folder_id: rootFolderId,
      pending_folders: pending,
      status: 'idle',
      last_error: null,
      stats: {},
      updated_at: new Date().toISOString()
    };

    const { error: upErr } = await admin
      .from("drive_sync_state")
      .upsert(upsertData, { onConflict: "user_id" });
    
    if (upErr) throw upErr;

    console.log(`Sync initialized for user ${userId}, root folder: ${rootFolderId}`);

    return httpJson(200, { ok: true, rootFolderId, cid }, req.headers.get('origin'));
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