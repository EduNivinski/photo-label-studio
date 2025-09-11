import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { upsertTokens } from "../_shared/token_provider_v2.ts";

serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  const err = url.searchParams.get("error");

  const html = (body: string, status = 200) =>
    new Response(`<!doctype html><meta charset="utf-8"><body>${body}</body>`, {
      status, headers: { "Content-Type": "text/html" }
    });

  if (err) return html(`<h3>Google error</h3><pre>${err}</pre>`, 400);
  if (!code || !stateRaw) return html("<h3>MISSING_CODE_OR_STATE</h3>", 400);

  let state: any;
  try { state = JSON.parse(atob(stateRaw)); } catch { return html("<h3>INVALID_STATE</h3>", 400); }
  const userId = state?.userId;
  if (!userId) return html("<h3>MISSING_USER_ID</h3>", 400);

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
    return html(`<h3>CODE_EXCHANGE_FAILED</h3><pre>${JSON.stringify(tokenJson)}</pre>`, 400);
  }

  const access_token  = tokenJson.access_token as string | undefined;
  const refresh_token = tokenJson.refresh_token as string | undefined; // pode não vir
  const scopeStr      = (tokenJson.scope as string | undefined) ?? "";
  const expires_in    = Number(tokenJson.expires_in ?? 3600);
  const expires_at    = new Date(Date.now() + Math.max(0, (expires_in - 60)) * 1000).toISOString();

  if (!access_token) return html("<h3>MISSING_ACCESS_TOKEN</h3>", 400);

  try {
    await upsertTokens(userId, access_token, refresh_token ?? null, scopeStr, expires_at);
  } catch (e: any) {
    return html(`<h3>DB_UPSERT_FAILED</h3><pre>${e?.message}</pre>`, 500);
  }

  // Fecha popup e notifica app
  return new Response(`<!doctype html><meta charset="utf-8"><body>
  <script>
    try { window.opener && window.opener.postMessage({ type: "drive_connected" }, "*"); window.close(); } catch(e){}
    setTimeout(()=>location.replace("/user"), 300);
  </script>
  <p>Conexão realizada. Você pode fechar esta janela.</p>
  </body>`, { status: 200, headers: { "Content-Type": "text/html" }});
});