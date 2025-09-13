import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ensureAccessToken } from "../_shared/token_provider_v2.ts";

// --- CORS ---
const DEFAULT_ALLOWED = [
  "https://photo-label-studio.lovable.app",
  "http://localhost:3000",
  "http://localhost:5173",
];
const ALLOW = new Set(
  (Deno.env.get("CORS_ALLOWED_ORIGINS")?.split(",") ?? DEFAULT_ALLOWED)
    .map(s => s.trim()).filter(Boolean)
);
function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOW.has(origin) ? origin : "https://photo-label-studio.lovable.app";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, x-supabase-authorization",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
    "Content-Type": "application/json",
  };
}
const json = (req: Request, status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders(req.headers.get("origin")) });

function getBearer(req: Request): string | null {
  const a = req.headers.get("authorization");
  if (a && /^Bearer\s+/i.test(a)) return a.replace(/^Bearer\s+/i, "");
  const b = req.headers.get("x-supabase-authorization");
  if (b && /^Bearer\s+/i.test(b)) return b.replace(/^Bearer\s+/i, "");
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });

  try {
    // 1) JWT manual (gateway está verify_jwt=false)
    const token = getBearer(req);
    if (!token) return json(req, 401, { ok: false, reason: "MISSING_JWT" });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user }, error } = await admin.auth.getUser(token);
    if (error || !user) return json(req, 401, { ok: false, reason: "INVALID_JWT" });
    const userId = user.id;

    // 2) Access token do Drive (renova se precisar)
    let accessToken;
    try {
      accessToken = await ensureAccessToken(userId);
    } catch (e: any) {
      const m = (e?.message || "").toUpperCase();
      if (m.includes("NEEDS_RECONSENT")) {
        return json(req, 401, { status: 401, reason: "NEEDS_RECONSENT" });
      }
      return json(req, 500, { status: 500, reason: "INTERNAL", detail: e?.message });
    }

    // 3) Listar pastas na raiz
    const params = new URLSearchParams({
      fields: "files(id,name,mimeType),nextPageToken",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
      corpora: "user",
      q: "mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false",
      pageSize: "100",
    });

    // 1ª tentativa
    let r = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (r.status === 401) {
      // força refresh e tenta de novo uma vez
      try {
        const fresh = await ensureAccessToken(userId);
        r = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
          headers: { Authorization: `Bearer ${fresh}` },
        });
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          return json(req, 401, { ok: false, reason: "UNAUTHORIZED_AFTER_REFRESH", details: data });
        }
      } catch (e: any) {
        const msg = (e?.message || "").toUpperCase();
        return json(req, 401, { ok: false, reason: msg || "NEEDS_RECONSENT" });
      }
    }

    const data = await r.json().catch(() => ({}));
    if (!r.ok) return json(req, 502, { ok: false, reason: "GOOGLE_LIST_FAILED", details: data });

    return json(req, 200, { ok: true, files: data.files ?? [], nextPageToken: data.nextPageToken ?? null });
  } catch (e: any) {
    return json(req, 500, { ok: false, reason: e?.message || "INTERNAL_ERROR" });
  }
});