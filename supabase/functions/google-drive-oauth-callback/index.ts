import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { upsertTokens } from "../_shared/token_provider_v2.ts";

const okHtml = `<!doctype html><meta charset="utf-8"><body>
<script>
  try { window.opener && window.opener.postMessage({ type: "drive_connected" }, "*"); } catch(e){}
  try { window.close(); } catch(e){}
  setTimeout(()=>location.replace("/user"), 400);
</script>
<p>Google Drive conectado. Você pode fechar esta janela.</p>
</body>`;

function errHtml(msg: string) {
  const safe = (msg || "").toString().replace(/[<>&]/g, s => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[s]!));
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
    const oauthErr = url.searchParams.get("error");
    const html = (h: string, s = 200) => new Response(h, { status: s, headers: { "Content-Type": "text/html" } });

    if (oauthErr) return html(errHtml(`Google error: ${oauthErr}`), 400);
    if (!code || !stateRaw) return html(errHtml("MISSING_CODE_OR_STATE"), 400);

    // ⚠️ O "state" deve carregar o userId que emitimos no authorize
    let userId: string | null = null;
    try {
      const st = JSON.parse(atob(stateRaw));
      userId = st?.userId || null;
    } catch { /* no-op */ }
    if (!userId) return html(errHtml("MISSING_USER_ID_IN_STATE"), 400);

    const projectUrl = Deno.env.get("SUPABASE_URL")!.replace(/\/$/, "");
    const REDIRECT_URI = `${projectUrl}/functions/v1/google-drive-oauth-callback`;

    // Troca de code por tokens
    const tr = await fetch("https://oauth2.googleapis.com/token", {
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
    const tj = await tr.json().catch(() => ({}));
    if (!tr.ok) return html(errHtml(`CODE_EXCHANGE_FAILED: ${JSON.stringify(tj)}`), 400);

    const access_token  = tj.access_token as string | undefined;
    const refresh_token = tj.refresh_token as string | undefined; // pode vir undefined nas reautorizações
    const scopeStr      = (tj.scope as string | undefined) ?? "";
    const expires_in    = Number(tj.expires_in ?? 3600);
    const expires_at    = new Date(Date.now() + Math.max(0, (expires_in - 60)) * 1000).toISOString();
    if (!access_token) return html(errHtml("MISSING_ACCESS_TOKEN"), 400);

    // Persistir via Service-Role (helper já usa SR e preserva refresh quando ausente)
    await upsertTokens(userId, access_token, refresh_token ?? null, scopeStr, expires_at);

    // ✅ Sucesso: sempre HTML e fechar popup
    return html(okHtml, 200);
  } catch (e: any) {
    return new Response(errHtml(e?.message || "UNKNOWN_ERROR"), {
      status: 500,
      headers: { "Content-Type": "text/html" },
    });
  }
});