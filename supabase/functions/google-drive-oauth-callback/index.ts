import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { upsertTokens } from "../_shared/token_provider_v2.ts";

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const stateRaw = url.searchParams.get("state");
    const err = url.searchParams.get("error");

    const html = (body: string, status = 200) =>
      new Response(`<!doctype html><meta charset="utf-8"><body>${body}</body>`, {
        status, headers: { "Content-Type": "text/html" }
      });

    const errorHtml = (errMessage: string, status = 400) =>
      new Response(`<!doctype html><meta charset="utf-8"><body>
      <script>
        try { window.opener && window.opener.postMessage({ type: "drive_connect_error" }, "*"); window.close(); } catch(e){}
        setTimeout(()=>location.replace("/user"), 800);
      </script>
      <pre>${escapeHtml(errMessage)}</pre>
      </body>`, { status, headers: { "Content-Type": "text/html" }});

    if (err) return errorHtml(`Google error: ${err}`);
    if (!code || !stateRaw) return errorHtml("MISSING_CODE_OR_STATE");

    let state: any;
    try { state = JSON.parse(atob(stateRaw)); } catch { return errorHtml("INVALID_STATE"); }
    const userId = state?.userId;
    if (!userId) return errorHtml("MISSING_USER_ID");

    const projectUrl = Deno.env.get("SUPABASE_URL")!.replace(/\/$/, "");
    const REDIRECT_URI = `${projectUrl}/functions/v1/google-drive-oauth-callback`;

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
      return errorHtml(`CODE_EXCHANGE_FAILED: ${JSON.stringify(tokenJson)}`);
    }

    const access_token  = tokenJson.access_token as string | undefined;
    const refresh_token = tokenJson.refresh_token as string | undefined; // pode não vir
    const scopeStr      = (tokenJson.scope as string | undefined) ?? "";
    const expires_in    = Number(tokenJson.expires_in ?? 3600);
    const expires_at    = new Date(Date.now() + Math.max(0, (expires_in - 60)) * 1000).toISOString();

    if (!access_token) return errorHtml("MISSING_ACCESS_TOKEN");

    try {
      await upsertTokens(userId, access_token, refresh_token ?? null, scopeStr, expires_at);
    } catch (e: any) {
      return errorHtml(`DB_UPSERT_FAILED: ${e?.message}`);
    }

    // Fecha popup e notifica app
    return new Response(`<!doctype html><meta charset="utf-8"><body>
    <script>
      try { window.opener && window.opener.postMessage({ type: "drive_connected" }, "*"); window.close(); } catch(e){}
      setTimeout(()=>location.replace("/user"), 300);
    </script>
    <p>Conexão realizada. Você pode fechar esta janela.</p>
    </body>`, { status: 200, headers: { "Content-Type": "text/html" }});

  } catch (error: any) {
    // Final catch-all: sempre retorna HTML mesmo em erros inesperados
    return new Response(`<!doctype html><meta charset="utf-8"><body>
    <script>
      try { window.opener && window.opener.postMessage({ type: "drive_connect_error" }, "*"); window.close(); } catch(e){}
      setTimeout(()=>location.replace("/user"), 800);
    </script>
    <h3>UNEXPECTED_ERROR</h3>
    <pre>${escapeHtml(error?.message || "Unknown error")}</pre>
    </body>`, { status: 500, headers: { "Content-Type": "text/html" }});
  }
});