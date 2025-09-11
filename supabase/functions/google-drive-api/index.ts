import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { preflight, jsonCors } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ensureAccessToken } from "../_shared/token_provider_v2.ts";

// Helper: extrair userId do JWT (Authorization: Bearer <jwt>)
async function getUserIdFromJwt(req: Request): Promise<string | null> {
  try {
    const auth = req.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) return null;
    const token = auth.slice("Bearer ".length);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user } } = await admin.auth.getUser(token);
    return user?.id ?? null;
  } catch { return null; }
}

serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;

  try {
    const { action, folderId } = await req.json().catch(() => ({}));

    // ping não exige login Drive
    if (action === "ping") {
      return jsonCors(req, 200, { ok: true, pong: true });
    }

    // demais ações exigem JWT válido
    const userId = await getUserIdFromJwt(req);
    if (!userId) return jsonCors(req, 401, { ok: false, reason: "INVALID_JWT" });

    // tenta garantir access token (pode lançar erro)
    let accessToken: string;
    try {
      accessToken = await ensureAccessToken(userId);
    } catch (e: any) {
      const msg = (e?.message || "").toUpperCase();
      // Responder 200 com motivo, para UX melhor
      return jsonCors(req, 200, { ok: true, connected: false, reason: msg || "NO_TOKENS" });
    }

    // Exemplo de listagens (Google Drive v3)
    if (action === "listRoot") {
      const q = `"root" in parents and trashed=false`;
      const r = await fetch("https://www.googleapis.com/drive/v3/files?"+new URLSearchParams({
        q, corpora: "user",
        includeItemsFromAllDrives: "true",
        supportsAllDrives: "true",
        fields: "files(id,name,mimeType,modifiedTime,parents,driveId,trashed)"
      }).toString(), {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data = await r.json();
      return jsonCors(req, 200, { ok: true, files: data.files ?? [] });
    }

    if (action === "listFolder") {
      const fId = folderId || "root";
      const q = `'${fId}' in parents and trashed=false`;
      const r = await fetch("https://www.googleapis.com/drive/v3/files?"+new URLSearchParams({
        q, corpora: "user",
        includeItemsFromAllDrives: "true",
        supportsAllDrives: "true",
        fields: "files(id,name,mimeType,modifiedTime,parents,driveId,trashed)"
      }).toString(), {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data = await r.json();
      return jsonCors(req, 200, { ok: true, files: data.files ?? [] });
    }

    return jsonCors(req, 400, { ok: false, reason: "UNKNOWN_ACTION" });
  } catch (e: any) {
    console.error("google-drive-api error:", e?.message || e);
    return jsonCors(req, 500, { ok: false, reason: "INTERNAL_ERROR" });
  }
});