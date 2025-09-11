import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { upsertTokens } from "../_shared/token_provider_v2.ts";

const htmlOk = `<!doctype html><meta charset="utf-8"><body>
<script>
  try { window.opener && window.opener.postMessage({ type: "drive_connected" }, "*"); } catch(e){}
  try { window.close(); } catch(e){}
  setTimeout(()=>location.replace("/user"), 400);
</script>
<p>Google Drive conectado. Você pode fechar esta janela.</p>
</body>`;

function htmlErr(msg: string) {
  const safe = msg.replace(/[<>&]/g, s => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[s]!));
  return `<!doctype html><meta charset="utf-8"><body>
<script>
  try { window.opener && window.opener.postMessage({ type: "drive_connect_error", error: ${JSON.stringify(safe)} }, "*"); } catch(e){}
  try { window.close(); } catch(e){}
  setTimeout(()=>location.replace("/user"), 800);
</script>
<pre style="white-space:pre-wrap">${safe}</pre>
</body>`;
}

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const stateRaw = url.searchParams.get("state");
    const err = url.searchParams.get("error");
    if (err) return new Response(htmlErr(`Google error: ${err}`), { status: 400, headers: { "Content-Type": "text/html" }});
    if (!code || !stateRaw) return new Response(htmlErr("MISSING_CODE_OR_STATE"), { status: 400, headers: { "Content-Type": "text/html" }});

    let state: any;
    try { state = JSON.parse(atob(stateRaw)); } catch { return new Response(htmlErr("INVALID_STATE"), { status: 400, headers: { "Content-Type": "text/html" }}); }
    const userId = state?.userId;
    if (!userId) return new Response(htmlErr("MISSING_USER_ID"), { status: 400, headers: { "Content-Type": "text/html" }});

    // redirect_uri idêntico ao usado no authorize
    const projectUrl = Deno.env.get("SUPABASE_URL")!.replace(/\/$/, "");
    const REDIRECT_URI = `${projectUrl}/functions/v1/google-drive-oauth-callback`;

    // Troca do código por tokens
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
    if (!tokenResp.ok) return new Response(htmlErr(`CODE_EXCHANGE_FAILED: ${JSON.stringify(tokenJson)}`), { status: 400, headers: { "Content-Type": "text/html" }});

    const access_token  = tokenJson.access_token as string | undefined;
    const refresh_token = tokenJson.refresh_token as string | undefined; // pode vir undefined
    const scopeStr      = (tokenJson.scope as string | undefined) ?? "";
    const expires_in    = Number(tokenJson.expires_in ?? 3600);
    const expires_at    = new Date(Date.now() + Math.max(0, (expires_in - 60)) * 1000).toISOString();

    if (!access_token) return new Response(htmlErr("MISSING_ACCESS_TOKEN"), { status: 400, headers: { "Content-Type": "text/html" }});

    // Gravar tokens via helper (usa Service-Role internamente)
    await upsertTokens(userId, access_token, refresh_token ?? null, scopeStr, expires_at);

    // ✅ Sempre HTML — fecha popup
    return new Response(htmlOk, { status: 200, headers: { "Content-Type": "text/html" }});
  } catch (e: any) {
    return new Response(htmlErr(e?.message || "UNKNOWN_ERROR"), { status: 500, headers: { "Content-Type": "text/html" }});
  }
});