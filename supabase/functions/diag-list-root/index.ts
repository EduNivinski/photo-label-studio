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
    const refresh_token = data?.refresh_token;
    if (!access_token) return bad("NO_ACCESS_TOKEN");

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

    let resp = await fetch(buildUrl(), { headers: { Authorization: `Bearer ${access_token}` } });
    if (resp.status === 401 && refresh_token) {
      // TODO: troque por fluxo real de refresh de vocês
      console.warn("401 on files.list – implement refresh flow here");
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
    console.error("diag_list_root INTERNAL_ERROR", e?.message);
    return fail("INTERNAL_ERROR");
  }
});