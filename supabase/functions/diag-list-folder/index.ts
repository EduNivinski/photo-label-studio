import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ensureAccessToken } from "../_shared/token_provider_v2.ts";

const ALLOWED = new Set([
  "https://photo-label-studio.lovable.app",
  "http://localhost:3000",
  "http://localhost:5173",
  // "https://<SEU-SANDBOX>.sandbox.lovable.dev",
]);

function cors(origin: string | null) {
  const allowed = origin && ALLOWED.has(origin) ? origin : "https://photo-label-studio.lovable.app";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, x-supabase-authorization",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}
const json = (req: Request, status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors(req.headers.get("origin")) } });

function getBearer(req: Request): string | null {
  const h = req.headers;
  const a = h.get("authorization");
  if (a && /^Bearer\s+/i.test(a)) return a.replace(/^Bearer\s+/i, "");
  const b = h.get("x-supabase-authorization"); // fallback de alguns SDKs
  if (b && /^Bearer\s+/i.test(b)) return b.replace(/^Bearer\s+/i, "");
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req.headers.get("origin")) });

  try {
    // 1) Validar JWT manualmente
    const token = getBearer(req);
    if (!token) return json(req, 401, { ok: false, reason: "MISSING_JWT" });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return json(req, 401, { ok: false, reason: "INVALID_JWT" });
    const userId = user.id;

    // 2) Garantir access token do Drive
    const accessToken = await ensureAccessToken(userId); // lança em erro se inválido

    // 3) Listagem da pasta
    const { folderId, pageToken } = await req.json().catch(() => ({}));
    if (!folderId) return json(req, 400, { ok: false, reason: "MISSING_FOLDER_ID" });

    const params = new URLSearchParams({
      fields: "files(id,name,mimeType),nextPageToken",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
      corpora: "user",
      q: `'${folderId}' in parents and trashed=false`,
      pageSize: "100",
    });
    if (pageToken) params.set("pageToken", String(pageToken));

    const r = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await r.json();
    if (!r.ok) return json(req, 502, { ok: false, reason: "GOOGLE_LIST_FAILED", details: data });

    return json(req, 200, { ok: true, files: data.files ?? [], nextPageToken: data.nextPageToken ?? null });
  } catch (e: any) {
    return json(req, 500, { ok: false, reason: (e?.message || "INTERNAL_ERROR") });
  }
});