import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { upsertTokens } from "../_shared/token_provider_v2.ts";

const okHtml = `<!doctype html><meta charset="utf-8"><body>
<script>
  try { window.opener && window.opener.postMessage({ type: "drive_connected" }, "*"); } catch(e){}
  try { window.close(); } catch(e){}
  setTimeout(()=>location.replace("/user"), 400);
</script>
<p>Google Drive conectado. Pode fechar esta janela.</p>
</body>`;

const errHtml = (msg: string) => {
  const safe = msg.replace(/[<>&]/g, s => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[s]!));
  return `<!doctype html><meta charset="utf-8"><body>
<script>
  try { window.opener && window.opener.postMessage({ type: "drive_connect_error", error: ${JSON.stringify(safe)} }, "*"); } catch(e){}
  try { window.close(); } catch(e){}
  setTimeout(()=>location.replace("/user"), 800);
</script>
<pre style="white-space:pre-wrap">${safe}</pre>
</body>`;
};

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const stateRaw = url.searchParams.get("state");
    const err = url.searchParams.get("error");
    if (err)  return new Response(errHtml(`Google error: ${err}`),  { status: 400, headers: { "Content-Type": "text/html" }});
    if (!code || !stateRaw) return new Response(errHtml("MISSING_CODE_OR_STATE"), { status: 400, headers: { "Content-Type": "text/html" }});

    // state simples (gerado no authorize): { userId, ts, nonce } em base64
    let state: any;
    try { state = JSON.parse(atob(stateRaw)); } catch { return new Response(errHtml("INVALID_STATE"), { status: 400, headers: { "Content-Type": "text/html" }}); }
    const userId = state?.userId;
    if (!userId) return new Response(errHtml("MISSING_USER_ID"), { status: 400, headers: { "Content-Type": "text/html" }});

    // trocar código por tokens (USAR o MESMO redirect_uri do authorize)
    const projectUrl   = Deno.env.get("SUPABASE_URL")!.replace(/\/$/, "");
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
      return new Response(errHtml(`CODE_EXCHANGE_FAILED: ${JSON.stringify(tokenJson)}`),
        { status: 400, headers: { "Content-Type": "text/html" }});
    }

    const access_token  = tokenJson.access_token as string | undefined;
    const refresh_token = tokenJson.refresh_token as string | undefined; // pode não vir
    const scopeStr      = (tokenJson.scope as string | undefined) ?? "";
    const expires_in    = Number(tokenJson.expires_in ?? 3600);
    const expires_at    = new Date(Date.now() + Math.max(0, (expires_in - 60)) * 1000).toISOString();

    if (!access_token) return new Response(errHtml("MISSING_ACCESS_TOKEN"), { status: 400, headers: { "Content-Type": "text/html" }});

    // salvar tokens via helper (usa Service-Role internamente e preserva refresh antigo)
    await upsertTokens(userId, access_token, refresh_token ?? null, scopeStr, expires_at);

    return new Response(okHtml, { status: 200, headers: { "Content-Type": "text/html" }});
  } catch (e: any) {
    return new Response(errHtml(e?.message || "UNKNOWN_ERROR"), { status: 500, headers: { "Content-Type": "text/html" }});
  }
});