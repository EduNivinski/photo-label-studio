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

const parseFolderId = async (req: Request) => {
  const url = new URL(req.url);
  const q = url.searchParams.get("folderId") || url.searchParams.get("folder_id");
  const h = req.headers.get("x-folder-id") || undefined;
  const body = await req.json().catch(() => ({} as any));
  return (body.folderId || body.folder_id || q || h) as string | undefined;
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
    
    const folder_id = await parseFolderId(req);
    if (!folder_id) return bad("MISSING_FOLDER_ID");

    const tokens = await getTokens(user_id);
    if (!tokens) return bad("NO_ACCESS_TOKEN");

    const buildUrl = () => {
      const u = new URL("https://www.googleapis.com/drive/v3/files");
      u.searchParams.set("q", `'${folder_id}' in parents and trashed=false`);
      u.searchParams.set("fields", "nextPageToken,files(id,name,mimeType)");
      u.searchParams.set("supportsAllDrives", "true");
      u.searchParams.set("includeItemsFromAllDrives", "true");
      u.searchParams.set("corpora", "user");
      u.searchParams.set("pageSize", "10");
      return u.toString();
    };

    let resp = await fetch(buildUrl(), { headers: { Authorization: `Bearer ${tokens.access_token}` } });
    
    if (resp.status === 401) {
      return json(401, { status: 401, reason: "UNAUTHORIZED_NEEDS_REFRESH", folder_id });
    }
    if (resp.status === 404) {
      return json(404, { status: 404, reason: "FOLDER_NOT_FOUND_OR_NO_ACCESS", folder_id });
    }
    if (resp.status === 403) {
      const body = await resp.json().catch(() => ({}));
      return json(403, { status: 403, reason: "INSUFFICIENT_PERMISSIONS", action: "RECONNECT_WITH_CONSENT", folder_id, detail: body?.error?.message });
    }

    const body = await resp.json().catch(() => ({}));
    return ok({
      status: resp.status,
      filesCount: body?.files?.length ?? 0,
      firstItems: (body?.files ?? []).slice(0, 5),
      folder_id,
      query: `'${folder_id}' in parents and trashed=false`
    });
  } catch (e: any) {
    console.error("diag_list_folder INTERNAL_ERROR", e?.message);
    return fail("INTERNAL_ERROR");
  }
});