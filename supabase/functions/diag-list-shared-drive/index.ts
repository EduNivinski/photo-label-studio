import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Crypto utilities
const b64ToU8 = (b64: string) => Uint8Array.from(atob(b64), c => c.charCodeAt(0));

let cryptoKey: CryptoKey | null = null;

async function getCryptoKey() {
  if (!cryptoKey) {
    const keyRaw = b64ToU8(Deno.env.get("TOKEN_ENC_KEY")!);
    cryptoKey = await crypto.subtle.importKey("raw", keyRaw, { name: "AES-GCM" }, false, ["decrypt"]);
  }
  return cryptoKey;
}

async function decryptFromB64(b64: string) {
  const key = await getCryptoKey();
  const buf = b64ToU8(b64);
  const iv = buf.slice(0, 12);
  const ct = buf.slice(12);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(pt);
}

// Token provider
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function getTokens(user_id: string) {
  const { data, error } = await supabaseAdmin
    .from("private.user_drive_tokens")
    .select("*")
    .eq("user_id", user_id)
    .maybeSingle();

  if (error) throw new Error("DB_ERROR");
  if (!data) return null;

  return {
    access_token: await decryptFromB64(data.access_token_enc),
    refresh_token: await decryptFromB64(data.refresh_token_enc),
    scope: data.scope,
    expires_at: data.expires_at
  };
}

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

    const tokens = await getTokens(user_id);
    if (!tokens) return bad("NO_ACCESS_TOKEN");

    // First, get shared drives
    const drivesResponse = await fetch('https://www.googleapis.com/drive/v3/drives?pageSize=10&fields=drives(id,name)', {
      headers: { 
        Authorization: `Bearer ${tokens.access_token}`,
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
        Authorization: `Bearer ${tokens.access_token}`,
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