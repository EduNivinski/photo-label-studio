import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { preflight, jsonCors } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ensureAccessToken } from "../_shared/token_provider_v2.ts";

// Helper: criar cliente admin
function admin() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

// Helper: extrair userId do JWT (Authorization: Bearer <jwt>)
async function getUserIdFromJwt(req: Request): Promise<string | null> {
  try {
    const auth = req.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) return null;
    const token = auth.slice("Bearer ".length);
    const adminClient = admin();
    const { data: { user } } = await adminClient.auth.getUser(token);
    return user?.id ?? null;
  } catch { return null; }
}

serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;

  const url = new URL(req.url);

  // Parse único do corpo (POST/PUT/PATCH)
  let body: any = {};
  if (["POST","PUT","PATCH"].includes(req.method)) {
    try { body = await req.json(); } catch { body = {}; }
  }

  // Ação: do body OU da querystring (fallback)
  const action = (body?.action || url.searchParams.get("action") || "").toString();

  try {
    const { folderId } = body;

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
      const { folderId } = body;
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

  if (action === "ensureDedicatedFolder") {
    try {
      const userId = await getUserIdFromJwt(req);
      if (!userId) return jsonCors(req, 401, { ok:false, reason:"INVALID_JWT" });

      // 0) garantir token
      let accessToken: string;
      try {
        const r = await ensureAccessToken(userId);
        accessToken = typeof r === "string" ? r : (r as any)?.accessToken;
        if (!accessToken) throw new Error("NO_ACCESS_TOKEN");
      } catch (e:any) {
        const msg = (e?.message||"").toUpperCase();
        return jsonCors(req, 200, { ok:false, step:"TOKEN", reason: msg || "NO_TOKENS" });
      }

      // 1) checar escopos atuais (opcional mas útil)
      // usa tokeninfo; se cair, não bloqueia
      let scopeOk = false;
      try {
        const ti = await fetch("https://www.googleapis.com/oauth2/v3/tokeninfo?access_token="+accessToken);
        const tj = await ti.json().catch(()=> ({}));
        const scopes = String(tj.scope || "").split(/\s+/);
        scopeOk = scopes.includes("https://www.googleapis.com/auth/drive.file");
        if (!scopeOk) {
          return jsonCors(req, 200, {
            ok:false, step:"SCOPES",
            reason:"MISSING_DRIVE_FILE_SCOPE",
            details:{ scopes }
          });
        }
      } catch { /* segue */ }

      const FOLDER_NAME = "Photo Label Studio (App)";

      // 2) procurar pasta na raiz
      const params = new URLSearchParams({
        q: `mimeType='application/vnd.google-apps.folder' and name='${FOLDER_NAME.replace(/'/g,"\\'")}' and 'root' in parents and trashed=false`,
        corpora: "user",
        includeItemsFromAllDrives: "true",
        supportsAllDrives: "true",
        fields: "files(id,name)"
      });
      const listRes = await fetch("https://www.googleapis.com/drive/v3/files?"+params.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const listJson = await listRes.json().catch(()=> ({}));
      if (!listRes.ok) {
        return jsonCors(req, 200, {
          ok:false, step:"LIST",
          reason:"LIST_FAILED",
          details:{ status:listRes.status, body:listJson }
        });
      }

      let folder = Array.isArray(listJson.files) ? listJson.files[0] : null;

      // 3) criar se não existe
      if (!folder) {
        const createRes = await fetch("https://www.googleapis.com/drive/v3/files?supportsAllDrives=true", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            name: FOLDER_NAME,
            mimeType: "application/vnd.google-apps.folder",
            parents: ["root"]
          })
        });
        const createJson = await createRes.json().catch(()=> ({}));
        if (!createRes.ok || !createJson.id) {
          return jsonCors(req, 200, {
            ok:false, step:"CREATE",
            reason:"CREATE_FOLDER_FAILED",
            details:{ status:createRes.status, body:createJson }
          });
        }
        folder = { id: createJson.id, name: createJson.name || FOLDER_NAME };
      }

      // 4) persistir meta
      const { error } = await admin().from("user_drive_meta").upsert({
        user_id: userId,
        dedicated_folder_id: folder.id,
        dedicated_folder_name: folder.name,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id" });

      if (error) {
        return jsonCors(req, 200, {
          ok:false, step:"META",
          reason:"META_UPSERT_FAILED",
          details:{ message: error.message, code: error.code }
        });
      }

      return jsonCors(req, 200, {
        ok:true,
        dedicatedFolderId: folder.id,
        dedicatedFolderName: folder.name
      });
    } catch (e:any) {
      // erro inesperado (aqui sim pode ser 500)
      return jsonCors(req, 500, { ok:false, reason:"INTERNAL_ERROR", error: String(e) });
    }
  }

  if (action === "createSampleFile") {
    try {
      const userId = await getUserIdFromJwt(req);
      if (!userId) return jsonCors(req, 401, { ok:false, reason:"INVALID_JWT" });

      // token
      let accessToken: string;
      try {
        const r = await ensureAccessToken(userId);
        accessToken = typeof r === "string" ? r : (r as any)?.accessToken;
        if (!accessToken) throw new Error("NO_ACCESS_TOKEN");
      } catch (e:any) {
        const msg = (e?.message||"").toUpperCase();
        return jsonCors(req, 200, { ok:false, step:"TOKEN", reason: msg || "NO_TOKENS" });
      }

      // parentId do body ou fallback da meta
      let parentId: string | null = body?.parentId ?? null;
      if (!parentId) {
        const { data: meta } = await admin()
          .from("user_drive_meta")
          .select("dedicated_folder_id")
          .eq("user_id", userId)
          .maybeSingle();
        parentId = meta?.dedicated_folder_id ?? null;
      }
      if (!parentId) return jsonCors(req, 200, { ok:false, step:"INPUT", reason:"MISSING_parentId" });

      // multipart upload (texto simples)
      const metadata = {
        name: "hello-from-photo-label.txt",
        mimeType: "text/plain",
        parents: [parentId],
      };
      const boundary = "-------plabel-boundary-" + crypto.randomUUID();
      const bodyStr = [
        `--${boundary}`,
        "Content-Type: application/json; charset=UTF-8",
        "",
        JSON.stringify(metadata),
        `--${boundary}`,
        "Content-Type: text/plain; charset=UTF-8",
        "",
        `created at ${new Date().toISOString()} 🎉`,
        `--${boundary}--`,
        ""
      ].join("\r\n");

      const upRes = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`
        },
        body: bodyStr
      });
      const upJson = await upRes.json().catch(()=> ({}));
      if (!upRes.ok || !upJson.id) {
        return jsonCors(req, 200, { ok:false, step:"UPLOAD", reason:"UPLOAD_FAILED", details:{ status: upRes.status, body: upJson }});
      }

      return jsonCors(req, 200, { ok:true, fileId: upJson.id, name: upJson.name });
    } catch (e:any) {
      return jsonCors(req, 500, { ok:false, reason:"INTERNAL_ERROR", error:String(e) });
    }
  }

  return jsonCors(req, 400, { ok: false, reason: "UNKNOWN_ACTION" });
  } catch (e: any) {
    console.error("google-drive-api error:", e?.message || e);
    return jsonCors(req, 500, { ok: false, reason: "INTERNAL_ERROR" });
  }
});