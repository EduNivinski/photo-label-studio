import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Crypto utilities
const b64ToU8 = (b64: string) => Uint8Array.from(atob(b64), c => c.charCodeAt(0));

let cryptoKey: CryptoKey | null = null;

async function getCryptoKey() {
  if (!cryptoKey) {
    const encKey = Deno.env.get("TOKEN_ENC_KEY");
    if (!encKey) {
      throw new Error("TOKEN_ENC_KEY environment variable not set");
    }
    console.log("Initializing crypto key...");
    const keyRaw = b64ToU8(encKey);
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
  try {
    console.log(`Getting tokens for user: ${user_id}`);
    
    const { data, error } = await supabaseAdmin
      .from("private.user_drive_tokens")
      .select("*")
      .eq("user_id", user_id)
      .maybeSingle();

    if (error) {
      console.error("Database error:", error);
      throw new Error(`DB_ERROR: ${error.message}`);
    }
    
    if (!data) {
      console.log("No tokens found for user");
      return null;
    }

    console.log("Found encrypted tokens, decrypting...");
    
    return {
      access_token: await decryptFromB64(data.access_token_enc),
      refresh_token: await decryptFromB64(data.refresh_token_enc),
      scope: data.scope,
      expires_at: data.expires_at
    };
  } catch (error: any) {
    console.error("Error in getTokens:", error);
    throw error;
  }
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
    console.log("diag-list-root: Starting request processing");
    
    const user_id = await parseUserId(req);
    console.log(`diag-list-root: Parsed user_id: ${user_id}`);
    
    if (!user_id) return bad("MISSING_USER_ID");

    const tokens = await getTokens(user_id);
    if (!tokens) {
      console.log("diag-list-root: No tokens found for user");
      return bad("NO_ACCESS_TOKEN");
    }

    console.log("diag-list-root: Tokens retrieved, querying Google Drive...");
    
    const buildUrl = () => {
      const u = new URL("https://www.googleapis.com/drive/v3/files");
      u.searchParams.set("q", "mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false");
      u.searchParams.set("fields", "nextPageToken,files(id,name)");
      u.searchParams.set("supportsAllDrives", "true");
      u.searchParams.set("includeItemsFromAllDrives", "true");
      u.searchParams.set("corpora", "user");
      u.searchParams.set("pageSize", "10");
      return u.toString();
    };

    let resp = await fetch(buildUrl(), { headers: { Authorization: `Bearer ${tokens.access_token}` } });
    if (resp.status === 401) {
      return json(401, { status: 401, reason: "UNAUTHORIZED_NEEDS_REFRESH" });
    }
    if (resp.status === 403) {
      const body = await resp.json().catch(() => ({}));
      return json(403, { status: 403, reason: "INSUFFICIENT_PERMISSIONS", action: "RECONNECT_WITH_CONSENT", detail: body?.error?.message });
    }

    const body = await resp.json().catch(() => ({}));
    return ok({
      status: resp.status,
      filesCount: body?.files?.length ?? 0,
      firstItems: (body?.files ?? []).slice(0, 3),
      echo: { corpora: "user", supportsAllDrives: true, includeItemsFromAllDrives: true, pageSize: 10 }
    });
  } catch (e: any) {
    console.error("diag_list_root INTERNAL_ERROR", e?.message, e?.stack);
    return fail("INTERNAL_ERROR");
  }
});