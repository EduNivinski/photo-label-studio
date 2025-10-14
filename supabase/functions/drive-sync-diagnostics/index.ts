import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth, httpJson } from "../_shared/http.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const traceId = crypto.randomUUID();
  const projectUrl = Deno.env.get("SUPABASE_URL");

  try {
    // Accept both GET and POST (supabase.functions.invoke uses POST by default)
    if (req.method !== "GET" && req.method !== "POST") {
      throw new Error("METHOD_NOT_ALLOWED");
    }
    
    const { userId } = await requireAuth(req);
    
    console.log("[diagnostics][env]", { traceId, projectUrl, user_id: userId });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Read settings
    const { data: settings } = await admin
      .from("user_drive_settings")
      .select("drive_folder_id, drive_folder_name, drive_folder_path, updated_at")
      .eq("user_id", userId)
      .maybeSingle();

    // Read sync state
    const { data: state } = await admin
      .from("drive_sync_state")
      .select("root_folder_id, pending_folders, status, start_page_token, updated_at")
      .eq("user_id", userId)
      .maybeSingle();

    console.log("[drive-sync-diagnostics]", {
      traceId,
      user_id: userId,
      settingsFolderId: settings?.drive_folder_id ?? null,
      stateRootFolderId: state?.root_folder_id ?? null
    });

    return httpJson(200, {
      ok: true,
      traceId,
      settings: settings ? {
        folderId: settings.drive_folder_id,
        folderName: settings.drive_folder_name,
        folderPath: settings.drive_folder_path,
        updatedAt: settings.updated_at,
      } : null,
      state: state ? {
        rootFolderId: state.root_folder_id,
        pending: state.pending_folders,
        status: state.status,
        startPageToken: state.start_page_token,
        updatedAt: state.updated_at,
      } : null
    }, req.headers.get('origin'));

  } catch (err: any) {
    console.error("[drive-sync-diagnostics][ERROR]", { 
      traceId, 
      error: err?.message || String(err) 
    });
    
    return httpJson(500, {
      ok: false,
      traceId,
      error: err?.message || "DIAGNOSTICS_FAILED"
    }, req.headers.get('origin'));
  }
});
