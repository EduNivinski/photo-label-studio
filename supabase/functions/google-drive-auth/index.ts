// Minimal, boot-safe, single-serve implementation with inline callback
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { preflight, jsonCors } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ensureAccessToken, upsertTokens } from "../_shared/token_provider_v2.ts";

// ---------- helpers ----------
function admin() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("MISSING_SUPABASE_ENV");
  return createClient(url, key);
}

// Validate user from Authorization: Bearer <jwt>
async function getUserIdFromJwt(req: Request): Promise<string | null> {
  try {
    const auth = req.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) return null;
    const jwt = auth.slice(7);
    const a = admin();
    const { data: { user } } = await a.auth.getUser(jwt);
    return user?.id ?? null;
  } catch { return null; }
}

function buildState(userId: string) {
  const obj = { userId, ts: Date.now(), nonce: crypto.getRandomValues(new Uint32Array(1))[0].toString(36) };
  return btoa(JSON.stringify(obj));
}

function okHtml() {
  return new Response(`<!doctype html><meta charset="utf-8"><body>
<script>
  try { window.opener && window.opener.postMessage({ source:"gdrive-oauth", ok:true }, "*"); } catch(e){}
  try { window.close(); } catch(e){}
  setTimeout(()=>location.replace("/user"), 400);
</script>
<p>Google Drive conectado. Pode fechar esta janela.</p>
</body>`, { status: 200, headers: { "Content-Type": "text/html" }});
}

function errHtml(msg: string, status = 400) {
  const safe = msg.replace(/[<>&]/g, s => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[s]!));
  return new Response(`<!doctype html><meta charset="utf-8"><body>
<script>
  try { window.opener && window.opener.postMessage({ source:"gdrive-oauth", ok:false, error:${JSON.stringify(safe)} }, "*"); } catch(e){}
  try { window.close(); } catch(e){}
  setTimeout(()=>location.replace("/user"), 800);
</script>
<pre style="white-space:pre-wrap">${safe}</pre>
</body>`, { status, headers: { "Content-Type": "text/html" }});
}

async function handleAuthorize(req: Request, userId: string) {
  const body = await req.json().catch(() => ({} as any));
  const forceConsent = !!body?.forceConsent;
  const projectUrl = Deno.env.get("SUPABASE_URL")!.replace(/\/$/, "");
  const REDIRECT_URI = `${projectUrl}/functions/v1/google-drive-auth/callback`;

  const params = new URLSearchParams({
    client_id: Deno.env.get("GOOGLE_DRIVE_CLIENT_ID")!,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: forceConsent ? "consent select_account" : "select_account",
    scope: [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/drive.metadata.readonly",
      "https://www.googleapis.com/auth/drive.file",
    ].join(" "),
    state: buildState(userId),
  });
  const authorizeUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  return jsonCors(req, 200, { ok: true, authorizeUrl, redirect_uri: REDIRECT_URI });
}

async function handleStatus(req: Request, userId: string) {
  try {
    const r = await ensureAccessToken(userId); // sua versão atual
    if ((r as any)?.ok === false) {
      return jsonCors(req, 200, { ok: true, connected: false, reason: (r as any).reason || "EXPIRED_OR_INVALID" });
    }
    const accessToken = (typeof r === "string") ? r : (r as any)?.accessToken;
    if (!accessToken) throw new Error("NO_ACCESS_TOKEN");
    
    // incluir pasta no status
    const a = admin();
    const { data: meta } = await a
      .from("user_drive_meta")
      .select("dedicated_folder_id, dedicated_folder_name")
      .eq("user_id", userId)
      .maybeSingle();

    return jsonCors(req, 200, {
      ok: true,
      connected: true,
      dedicatedFolderId: meta?.dedicated_folder_id || null,
      dedicatedFolderName: meta?.dedicated_folder_name || null
    });
  } catch (e: any) {
    return jsonCors(req, 200, { ok: true, connected: false, reason: (e?.message || "UNKNOWN").toUpperCase() });
  }
}

async function handleDisconnect(req: Request, userId: string) {
  const { error } = await admin().from("user_drive_tokens").delete().eq("user_id", userId);
  if (error) return jsonCors(req, 500, { ok: false, reason: "RESET_FAILED" });
  return jsonCors(req, 200, { ok: true, reset: true });
}

// ---------- server with inline callback ----------
serve(async (req: Request) => {
  // CORS preflight
  const pf = preflight(req);
  if (pf) return pf;

  const url = new URL(req.url);

  // 1) Inline callback: DOES NOT require JWT (GET from Google)
  if (req.method === "GET" && url.pathname.endsWith("/google-drive-auth/callback")) {
    try {
      // simple ping for sanity (optional)
      if (url.searchParams.has("__ping")) {
        return new Response(`<!doctype html><meta charset="utf-8"><body>CB-OK inline</body>`,
          { status: 200, headers: { "Content-Type": "text/html" }});
      }

      const code = url.searchParams.get("code");
      const stateRaw = url.searchParams.get("state");
      const err = url.searchParams.get("error");
      if (err) return errHtml(`Google error: ${err}`, 400);
      if (!code || !stateRaw) return errHtml("MISSING_CODE_OR_STATE", 400);

      let state: any = {};
      try { state = JSON.parse(atob(stateRaw)); } catch {}
      const userId = state?.userId || null;
      if (!userId) return errHtml("MISSING_USER_ID", 400);

      const projectUrl = Deno.env.get("SUPABASE_URL")!.replace(/\/$/, "");
      const REDIRECT_URI = `${projectUrl}/functions/v1/google-drive-auth/callback`;

      const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: Deno.env.get("GOOGLE_DRIVE_CLIENT_ID")!,
          client_secret: Deno.env.get("GOOGLE_DRIVE_CLIENT_SECRET")!,
          redirect_uri: REDIRECT_URI,
          grant_type: "authorization_code",
        }).toString(),
      });

      const tokenJson = await tokenResp.json().catch(() => ({}));
      if (!tokenResp.ok) {
        return errHtml(`CODE_EXCHANGE_FAILED: ${JSON.stringify(tokenJson)}`, 400);
      }

      const access_token  = tokenJson.access_token as string | undefined;
      const refresh_token = (tokenJson.refresh_token as string | undefined) ?? null;
      const scopeStr      = (tokenJson.scope as string | undefined) ?? "";
      const expires_in    = Number(tokenJson.expires_in ?? 3600);
      const expires_at    = new Date(Date.now() + Math.max(60, expires_in - 60) * 1000).toISOString();

      if (!access_token) return errHtml("MISSING_ACCESS_TOKEN", 400);

      await upsertTokens(userId, access_token, refresh_token, scopeStr, expires_at);
      return okHtml();
    } catch (e: any) {
      return errHtml(`UNKNOWN_ERROR: ${e?.message || e}`, 500);
    }
  }

  // 2) POST actions (require JWT)
  if (req.method === "POST") {
    let action = "";
    try { const body = await req.json(); action = body?.action || ""; } catch {}
    if (!action) return jsonCors(req, 400, { ok: false, reason: "MISSING_ACTION" });

    const userId = await getUserIdFromJwt(req);
    if (!userId) return jsonCors(req, 401, { ok: false, reason: "INVALID_JWT" });

    if (action === "authorize") return handleAuthorize(req, userId);
    if (action === "status")    return handleStatus(req, userId);
    if (action === "disconnect")return handleDisconnect(req, userId);
    return jsonCors(req, 400, { ok: false, reason: "UNKNOWN_ACTION" });
  }

  // Default
  return jsonCors(req, 405, { ok: false, reason: "METHOD_NOT_ALLOWED" });
});