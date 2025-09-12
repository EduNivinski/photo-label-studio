import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { upsertTokens } from "../_shared/token_provider_v2.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function audit(phase: string, userId: string | null, payload: Record<string, unknown> = {}) {
  try {
    await admin().from("drive_oauth_audit").insert({
      user_id: userId ?? "00000000-0000-0000-0000-000000000000",
      phase,
      has_access_token: !!payload.has_access_token,
      has_refresh_token: !!payload.has_refresh_token,
      details: payload.details ?? null,
    });
  } catch {/* no-op */}
}

const okHtml = (msg = "Google Drive conectado.") => `<!doctype html><meta charset="utf-8"><body>
<script>
  try { window.opener && window.opener.postMessage({ source:"gdrive-oauth", ok:true }, "*"); } catch(e){}
  try { window.close(); } catch(e){}
  setTimeout(()=>location.replace("/user"), 400);
</script>
<p>${msg}</p>
</body>`;

const errHtml = (msg: string) => {
  const safe = msg.replace(/[<>&]/g, s => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[s]!));
  return `<!doctype html><meta charset="utf-8"><body>
<script>
  try { window.opener && window.opener.postMessage({ source:"gdrive-oauth", ok:false, error:${JSON.stringify(safe)} }, "*"); } catch(e){}
  try { window.close(); } catch(e){}
  setTimeout(()=>location.replace("/user"), 800);
</script>
<pre style="white-space:pre-wrap">${safe}</pre>
</body>`;
};

serve(async (req) => {
  const url = new URL(req.url);
  const projectUrl = Deno.env.get("SUPABASE_URL")!.replace(/\/$/,"");
  const REDIRECT_URI = `${projectUrl}/functions/v1/gdrive-cb`;

  // prova de vida do callback
  if (url.searchParams.has("__ping")) {
    await audit("cb_boot", null, { details: { ping:true }});
    return new Response(`<!doctype html><meta charset="utf-8"><body>
      <p>CB-OK (gdrive-cb)</p></body>`, {
      status: 200,
      headers: { "Content-Type":"text/html", "X-Debug-Where":"gdrive-cb" }
    });
  }

  await audit("cb_boot", null, { details: { path: url.pathname }});

  try {
    const code = url.searchParams.get("code");
    const stateRaw = url.searchParams.get("state");
    const err = url.searchParams.get("error");
    if (err)  { await audit("exchange_fail", null, { details:{ error:err }}); return new Response(errHtml(`Google error: ${err}`), { status: 400, headers:{ "Content-Type":"text/html" }}); }
    if (!code || !stateRaw) { await audit("exchange_fail", null, { details:{ reason:"MISSING_CODE_OR_STATE" }}); return new Response(errHtml("MISSING_CODE_OR_STATE"), { status: 400, headers:{ "Content-Type":"text/html" }}); }

    let state: any = {};
    try { state = JSON.parse(atob(stateRaw)); } catch { /* ignore */ }
    const userId = state?.userId || null;
    if (!userId) { await audit("exchange_fail", null, { details:{ reason:"MISSING_USER_ID" }}); return new Response(errHtml("MISSING_USER_ID"), { status: 400, headers:{ "Content-Type":"text/html" }}); }

    await audit("exchange_start", userId, { details:{ redirect_uri: REDIRECT_URI }});

    const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type":"application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: Deno.env.get("GOOGLE_DRIVE_CLIENT_ID")!,
        client_secret: Deno.env.get("GOOGLE_DRIVE_CLIENT_SECRET")!,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }).toString()
    });

    const tokenJson = await tokenResp.json().catch(()=> ({}));
    if (!tokenResp.ok) {
      await audit("exchange_fail", userId, { details: tokenJson });
      return new Response(errHtml(`CODE_EXCHANGE_FAILED: ${JSON.stringify(tokenJson)}`), {
        status: 400, headers:{ "Content-Type":"text/html" }
      });
    }

    const access_token  = tokenJson.access_token as string | undefined;
    const refresh_token = tokenJson.refresh_token as string | undefined | null;
    const scopeStr      = (tokenJson.scope as string | undefined) ?? "";
    const expires_in    = Number(tokenJson.expires_in ?? 3600);
    const expires_at    = new Date(Date.now() + Math.max(60, expires_in - 60) * 1000).toISOString();

    await audit("exchange_ok", userId, {
      has_access_token: !!access_token,
      has_refresh_token: !!refresh_token,
      details: { scope: scopeStr, expires_in }
    });

    if (!access_token) {
      await audit("upsert_fail", userId, { details:{ reason: "MISSING_ACCESS_TOKEN" }});
      return new Response(errHtml("MISSING_ACCESS_TOKEN"), { status: 400, headers:{ "Content-Type":"text/html" }});
    }

    try {
      await upsertTokens(userId, access_token, refresh_token ?? null, scopeStr, expires_at);
      await audit("upsert_ok", userId, { has_access_token:true, has_refresh_token: !!refresh_token });
    } catch (e) {
      await audit("upsert_fail", userId, { details:{ error: String(e) }});
      return new Response(errHtml("UPSERT_FAILED"), { status: 500, headers:{ "Content-Type":"text/html" }});
    }

    return new Response(okHtml(), { status: 200, headers:{ "Content-Type":"text/html", "X-Debug-Where":"gdrive-cb" }});
  } catch (e:any) {
    await audit("cb_error", null, { details:{ error:String(e) }});
    return new Response(errHtml("UNKNOWN_ERROR"), { status: 500, headers:{ "Content-Type":"text/html" }});
  }
});