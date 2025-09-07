import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Utility functions
const json = (s: number, b: unknown) => new Response(JSON.stringify(b), {
  status: s, 
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type, x-user-id",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
  }
});

const ok = (b: unknown) => json(200, b);
const bad = (r: string, extra: unknown = {}) => json(400, { status: 400, reason: r, ...extra });
const fail = (r: string, extra: unknown = {}) => json(500, { status: 500, reason: r, ...extra });

const parseUserId = async (req: Request) => {
  const url = new URL(req.url);
  const q = url.searchParams.get("user_id");
  const h = req.headers.get("x-user-id") || undefined;
  const body = await req.json().catch(() => ({} as any));
  return (body.user_id || q || h) as string | undefined;
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type, x-user-id",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
      }
    });
  }
  
  try {
    const user_id = await parseUserId(req);
    if (!user_id) return bad("MISSING_USER_ID");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data, error } = await sb.rpc("get_google_drive_tokens_secure", { p_user_id: user_id });
    if (error) return fail("RPC_ERROR");
    const access_token = data?.access_token;
    if (!access_token) return bad("NO_ACCESS_TOKEN");

    // First, get shared drives
    const drivesResponse = await fetch('https://www.googleapis.com/drive/v3/drives?pageSize=10&fields=drives(id,name)', {
      headers: { 
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (drivesResponse.status === 401) {
      return json(401, { status: 401, reason: "UNAUTHORIZED_NEEDS_REFRESH", step: "drives_list" });
    }
    if (drivesResponse.status === 403) {
      const body = await drivesResponse.json().catch(() => ({}));
      return json(403, { status: 403, reason: "INSUFFICIENT_PERMISSIONS", action: "RECONNECT_WITH_CONSENT", step: "drives_list", detail: body?.error?.message });
    }
    if (!drivesResponse.ok) {
      return json(drivesResponse.status, { status: drivesResponse.status, reason: "GOOGLE_API_ERROR", step: "drives_list" });
    }

    const drivesData = await drivesResponse.json();
    const drives = drivesData.drives || [];
    
    if (drives.length === 0) {
      return ok({ status: 200, message: "No shared drives available", drivesCount: 0, firstDrive: null });
    }
    
    // Test listing files in the first shared drive
    const firstDrive = drives[0];
    const filesUrl = new URL("https://www.googleapis.com/drive/v3/files");
    filesUrl.searchParams.set("corpora", "drive");
    filesUrl.searchParams.set("driveId", firstDrive.id);
    filesUrl.searchParams.set("supportsAllDrives", "true");
    filesUrl.searchParams.set("includeItemsFromAllDrives", "true");
    filesUrl.searchParams.set("fields", "files(id,name,mimeType)");
    filesUrl.searchParams.set("pageSize", "10");

    const filesResponse = await fetch(filesUrl.toString(), {
      headers: { 
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!filesResponse.ok) {
      return json(filesResponse.status, { status: filesResponse.status, reason: "SHARED_DRIVE_FILES_ERROR", drive: firstDrive });
    }

    const filesData = await filesResponse.json();
    const files = filesData.files || [];
    
    return ok({
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
  } catch (e: any) {
    console.error("diag_list_shared INTERNAL_ERROR", e?.message);
    return fail("INTERNAL_ERROR");
  }
});