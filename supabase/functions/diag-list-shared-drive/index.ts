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
    console.log('🤝 DIAG LIST SHARED: Starting shared drives listing');
    
    const { user_id } = (await req.json().catch(() => ({}))) as { user_id?: string };
    if (!user_id) {
      console.log('❌ DIAG LIST SHARED: Missing user_id');
      return json(400, { error: "MISSING_USER_ID" });
    }

    console.log('🤝 DIAG LIST SHARED: Checking for user:', user_id);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!, 
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    
    console.log('🤝 DIAG LIST SHARED: Fetching tokens via RPC');
    const { data, error } = await supabase.rpc("get_google_drive_tokens_secure", { p_user_id: user_id });
    
    if (error) {
      console.error('❌ DIAG LIST SHARED: RPC error:', error);
      return json(500, { error: "RPC_ERROR", details: error.message });
    }

    if (!data || data.length === 0) {
      console.log('❌ DIAG LIST SHARED: No tokens found');
      return json(404, { error: "NO_TOKENS_FOUND" });
    }

    const tokenData = data[0];
    const access_token = tokenData.access_token;
    
    if (!access_token) {
      console.log('❌ DIAG LIST SHARED: No access token');
      return json(404, { error: "NO_ACCESS_TOKEN" });
    }

    // First, get shared drives
    console.log('🤝 DIAG LIST SHARED: Fetching shared drives list');
    const drivesResponse = await fetch('https://www.googleapis.com/drive/v3/drives?pageSize=10&fields=drives(id,name)', {
      headers: { 
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('🤝 DIAG LIST SHARED: Drives API response status:', drivesResponse.status);
    
    if (drivesResponse.status === 401) {
      console.error('❌ DIAG LIST SHARED: 401 Unauthorized on drives');
      return json(401, { 
        status: 401, 
        error: "UNAUTHORIZED",
        step: "drives_list"
      });
    }

    if (!drivesResponse.ok) {
      console.error('❌ DIAG LIST SHARED: Drives API error:', drivesResponse.status);
      return json(drivesResponse.status, {
        status: drivesResponse.status,
        error: "DRIVES_API_ERROR"
      });
    }

    const drivesData = await drivesResponse.json();
    const drives = drivesData.drives || [];
    
    console.log('🤝 DIAG LIST SHARED: Found drives:', drives.length);
    
    if (drives.length === 0) {
      return json(200, {
        status: 200,
        message: "No shared drives available",
        drivesCount: 0,
        firstDrive: null
      });
    }
    
    // Test listing files in the first shared drive
    const firstDrive = drives[0];
    console.log('🤝 DIAG LIST SHARED: Testing first drive:', firstDrive.name);
    
    const filesUrl = new URL("https://www.googleapis.com/drive/v3/files");
    filesUrl.searchParams.set("corpora", "drive");
    filesUrl.searchParams.set("driveId", firstDrive.id);
    filesUrl.searchParams.set("supportsAllDrives", "true");
    filesUrl.searchParams.set("includeItemsFromAllDrives", "true");
    filesUrl.searchParams.set("fields", "files(id,name,mimeType)");
    filesUrl.searchParams.set("pageSize", "10");

    console.log('🤝 DIAG LIST SHARED: Calling files API for drive');
    const filesResponse = await fetch(filesUrl.toString(), {
      headers: { 
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('🤝 DIAG LIST SHARED: Files API response status:', filesResponse.status);
    
    if (!filesResponse.ok) {
      console.error('❌ DIAG LIST SHARED: Files API error:', filesResponse.status);
      return json(filesResponse.status, {
        status: filesResponse.status,
        error: "SHARED_DRIVE_FILES_ERROR",
        drive: firstDrive
      });
    }

    const filesData = await filesResponse.json();
    const files = filesData.files || [];
    
    console.log('✅ DIAG LIST SHARED: Complete - files found:', files.length);
    
    return json(200, {
      status: 200,
      drivesCount: drives.length,
      drive: { id: firstDrive.id, name: firstDrive.name },
      filesCount: files.length,
      firstItems: files.slice(0, 5),
      echo: {
        corpora: "drive",
        driveId: firstDrive.id,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true
      }
    });
  } catch (e) {
    console.error("❌ DIAG LIST SHARED: Unexpected error", { msg: e?.message, name: e?.name });
    return json(500, { error: "INTERNAL_ERROR", note: "check function logs" });
  }
});