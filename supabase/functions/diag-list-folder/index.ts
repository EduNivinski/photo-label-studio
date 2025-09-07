import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const json = (s: number, b: unknown) => 
  new Response(JSON.stringify(b), { 
    status: s, 
    headers: { 
      "Content-Type": "application/json", 
      "Access-Control-Allow-Origin": "*", 
      "Access-Control-Allow-Headers": "authorization, content-type" 
    }
  });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  
  try {
    console.log('📁 DIAG LIST FOLDER: Starting folder listing');
    
    const { user_id, folder_id } = (await req.json().catch(() => ({}))) as { user_id?: string, folder_id?: string };
    
    if (!user_id) {
      console.log('❌ DIAG LIST FOLDER: Missing user_id');
      return json(400, { error: "MISSING_USER_ID" });
    }
    
    if (!folder_id) {
      console.log('❌ DIAG LIST FOLDER: Missing folder_id');
      return json(400, { error: "MISSING_FOLDER_ID" });
    }

    console.log('📁 DIAG LIST FOLDER: Checking user:', user_id, 'folder:', folder_id);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!, 
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    
    console.log('📁 DIAG LIST FOLDER: Fetching tokens via RPC');
    const { data, error } = await supabase.rpc("get_google_drive_tokens_secure", { p_user_id: user_id });
    
    if (error) {
      console.error('❌ DIAG LIST FOLDER: RPC error:', error);
      return json(500, { error: "RPC_ERROR", details: error.message });
    }

    if (!data || data.length === 0) {
      console.log('❌ DIAG LIST FOLDER: No tokens found');
      return json(404, { error: "NO_TOKENS_FOUND" });
    }

    const tokenData = data[0];
    const access_token = tokenData.access_token;
    
    if (!access_token) {
      console.log('❌ DIAG LIST FOLDER: No access token');
      return json(404, { error: "NO_ACCESS_TOKEN" });
    }

    // files.list for specific folder
    console.log('📁 DIAG LIST FOLDER: Building Drive API query for folder');
    const url = new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.set("q", `'${folder_id}' in parents and trashed=false`);
    url.searchParams.set("fields", "nextPageToken, files(id,name,mimeType)");
    url.searchParams.set("supportsAllDrives", "true");
    url.searchParams.set("includeItemsFromAllDrives", "true");
    url.searchParams.set("corpora", "user");
    url.searchParams.set("pageSize", "10");

    console.log('📁 DIAG LIST FOLDER: Calling Drive API:', url.toString());
    let resp = await fetch(url.toString(), { 
      headers: { 
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      } 
    });

    console.log('📁 DIAG LIST FOLDER: Drive API response status:', resp.status);

    if (resp.status === 401) {
      console.error('❌ DIAG LIST FOLDER: 401 Unauthorized');
      return json(401, { 
        status: 401, 
        error: "UNAUTHORIZED",
        folder_id: folder_id
      });
    }

    if (resp.status === 404) {
      console.error('❌ DIAG LIST FOLDER: 404 Folder not found');
      return json(404, {
        status: 404,
        error: "FOLDER_NOT_FOUND", 
        folder_id: folder_id,
        message: "Folder ID not found or inaccessible - clear selection and choose again"
      });
    }

    if (resp.status === 403) {
      console.error('❌ DIAG LIST FOLDER: 403 Insufficient permissions');
      return json(403, {
        status: 403,
        error: "INSUFFICIENT_PERMISSIONS",
        folder_id: folder_id
      });
    }

    const body = await resp.json().catch(() => ({}));
    
    console.log('✅ DIAG LIST FOLDER: Complete - items found:', body?.files?.length || 0);
    
    return json(resp.status, {
      status: resp.status,
      filesCount: body?.files?.length ?? 0,
      firstItems: (body?.files ?? []).slice(0, 5),
      folder_id: folder_id,
      query: `'${folder_id}' in parents and trashed=false`
    });
  } catch (e) {
    console.error("❌ DIAG LIST FOLDER: Unexpected error", { msg: e?.message, name: e?.name });
    return json(500, { error: "INTERNAL_ERROR", note: "check function logs" });
  }
});