import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (s: number, b: unknown) => 
  new Response(JSON.stringify(b), { 
    status: s, 
    headers: { 
      "Content-Type": "application/json", 
      ...corsHeaders
    }
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  
  try {
    console.log('📋 DIAG LIST ROOT: Starting root folder listing');
    
    const { user_id } = (await req.json().catch(() => ({}))) as { user_id?: string };
    if (!user_id) {
      console.log('❌ DIAG LIST ROOT: Missing user_id');
      return json(400, { status: 400, reason: "MISSING_USER_ID" });
    }

    console.log('📋 DIAG LIST ROOT: Checking for user:', user_id);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!, 
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    
    console.log('📋 DIAG LIST ROOT: Fetching tokens via RPC');
    const { data, error } = await supabase.rpc("get_google_drive_tokens_secure", { p_user_id: user_id });
    
    if (error) {
      console.error('❌ DIAG LIST ROOT: RPC error:', error);
      return json(500, { status: 500, reason: "RPC_ERROR", details: error.message });
    }

    if (!data || data.length === 0) {
      console.log('❌ DIAG LIST ROOT: No tokens found');
      return json(400, { status: 400, reason: "NO_TOKENS_FOUND" });
    }

    const tokenData = data[0];
    const access_token = tokenData.access_token;
    
    if (!access_token) {
      console.log('❌ DIAG LIST ROOT: No access token');
      return json(400, { status: 400, reason: "NO_ACCESS_TOKEN" });
    }

    // files.list — Meu Drive raiz
    console.log('📋 DIAG LIST ROOT: Building Drive API query');
    const url = new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.set("q", "mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false");
    url.searchParams.set("fields", "nextPageToken, files(id,name)");
    url.searchParams.set("supportsAllDrives", "true");
    url.searchParams.set("includeItemsFromAllDrives", "true");
    url.searchParams.set("corpora", "user");
    url.searchParams.set("pageSize", "10");

    console.log('📋 DIAG LIST ROOT: Calling Drive API:', url.toString());
    let resp = await fetch(url.toString(), { 
      headers: { 
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      } 
    });

    console.log('📋 DIAG LIST ROOT: Drive API response status:', resp.status);

    // Handle refresh on 401 (basic detection)
    if (resp.status === 401) {
      console.error('❌ DIAG LIST ROOT: 401 Unauthorized - token may be expired');
      return json(401, { 
        status: 401, 
        reason: "UNAUTHORIZED_AFTER_REFRESH",
        message: "Token expired or invalid - reconnection required"
      });
    }

    if (resp.status === 403) {
      console.error('❌ DIAG LIST ROOT: 403 Insufficient permissions');
      return json(403, {
        status: 403,
        reason: "INSUFFICIENT_PERMISSIONS", 
        action: "RECONNECT_WITH_CONSENT",
        message: "Missing required Drive scopes - reconnect with consent"
      });
    }

    if (!resp.ok) {
      return json(resp.status, { 
        status: resp.status, 
        reason: "GOOGLE_API_ERROR" 
      });
    }

    const body = await resp.json().catch(() => ({}));
    
    console.log('✅ DIAG LIST ROOT: Complete - folders found:', body?.files?.length || 0);
    
    return json(200, {
      status: 200,
      filesCount: body?.files?.length ?? 0,
      firstItems: (body?.files ?? []).slice(0, 5),
      query: "mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false",
      echo: { 
        corpora: "user", 
        supportsAllDrives: true, 
        includeItemsFromAllDrives: true, 
        pageSize: 10 
      }
    });
  } catch (e) {
    console.error("❌ DIAG LIST ROOT: Unexpected error", { msg: e?.message, name: e?.name });
    return json(500, { status: 500, reason: "INTERNAL_ERROR", note: "check function logs" });
  }
});