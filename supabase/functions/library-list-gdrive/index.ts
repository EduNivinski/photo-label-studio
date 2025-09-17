import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const APP_ORIGIN = "https://photo-label-studio.lovable.app";

function cors(origin: string) {
  const o = origin === APP_ORIGIN ? origin : APP_ORIGIN;
  return {
    "Access-Control-Allow-Origin": o,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };
}

function getAdmin() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

async function getUserId(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const jwt = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!jwt) throw new Error("INVALID_JWT");
  const admin = getAdmin();
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data?.user?.id) throw new Error("INVALID_JWT");
  return data.user.id as string;
}

serve(async (req) => {
  const origin = req.headers.get("origin") || APP_ORIGIN;

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors(origin) });
  }

  try {
    const uid = await getUserId(req);
    const body = await req.json().catch(() => ({}));
    const page = Math.max(1, Number(body.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(body.pageSize || 24)));
    const mimeClass = (body.mimeClass || "all") as "all" | "image" | "video";

    let q = getAdmin().from("drive_items")
      .select("file_id,name,mime_type,modified_time,created_time,web_view_link,thumbnail_link,path_cached,size,status", { count: "exact" })
      .eq("user_id", uid)
      .eq("trashed", false);

    if (mimeClass === "image") q = q.ilike("mime_type", "image/%");
    if (mimeClass === "video") q = q.ilike("mime_type", "video/%");

    q = q.order("modified_time", { ascending: false }).order("created_time", { ascending: false })
         .range((page - 1) * pageSize, page * pageSize - 1);

    const { data, error, count } = await q;
    if (error) throw new Error(`DB:${error.message}`);

    // normalizar p/ UI
    const items = (data || []).map((r: any) => ({
      id: `gdrive:${r.file_id}`,
      source: "gdrive",
      item_key: r.file_id,
      name: r.name,
      mime_type: r.mime_type,
      modified_time: r.modified_time,
      created_time: r.created_time,
      web_view_link: r.web_view_link || null,
      // thumbnail_url será resolvido pela UI via get-thumb-urls
      path: r.path_cached || null,
      size: r.size ? Number(r.size) : null,
      status: r.status || "active",
    }));

    return new Response(JSON.stringify({ ok: true, total: count ?? 0, items }), {
      status: 200, headers: cors(origin)
    });
  } catch (e: any) {
    const msg = e?.message || String(e);
    const code = msg === "INVALID_JWT" ? 401 : 500;
    return new Response(JSON.stringify({ ok: false, reason: "LIST_ERR", message: msg }), {
      status: code, headers: cors(origin)
    });
  }
});