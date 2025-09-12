import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { upsertTokens, decryptPacked, getExistingTokenRow } from "../_shared/token_provider_v2.ts";

const projectUrl = Deno.env.get("SUPABASE_URL")!;
const clientId = Deno.env.get("GOOGLE_DRIVE_CLIENT_ID")!;
const clientSecret = Deno.env.get("GOOGLE_DRIVE_CLIENT_SECRET")!;

function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function audit(phase: string, userId: string | null, payload: Record<string, unknown> = {}) {
  try {
    const admin = adminClient();
    await admin.from("drive_oauth_audit").insert({
      user_id: userId ?? "00000000-0000-0000-0000-000000000000",
      phase,
      has_access_token: !!payload.has_access_token,
      has_refresh_token: !!payload.has_refresh_token,
      details: payload.details ?? null,
    });
  } catch (_) {/* não quebra o fluxo */}
}

function htmlClose(payload: Record<string, unknown>) {
  const safe = JSON.stringify(payload);
  return new Response(
    `<!doctype html><meta charset="utf-8">
     <script>
       try { window.opener && window.opener.postMessage(${safe}, "*"); } catch(e) {}
       window.close();
       setTimeout(() => { document.body.innerText = 'Você pode fechar esta janela.'; }, 50);
     </script>`,
    { headers: { "content-type": "text/html; charset=utf-8" } }
  );
}

serve(async (req) => {
  const userId = (() => {
    try {
      const url = new URL(req.url);
      const stateRaw = url.searchParams.get("state");
      if (!stateRaw) return null;
      const state = JSON.parse(atob(stateRaw));
      return state.userId || null;
    } catch {
      return null;
    }
  })();

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const stateRaw = url.searchParams.get("state");
    if (!code || !stateRaw) {
      return htmlClose({ source: "gdrive-oauth", ok: false, reason: "MISSING_CODE_OR_STATE" });
    }

    let state: { userId?: string } = {};
    try { state = JSON.parse(atob(stateRaw)); } catch {}

    const redirect_uri = `${projectUrl}/functions/v1/google-drive-oauth-callback`;

    // Audit: exchange start
    await audit("exchange_start", userId, {
      details: { redirect_uri, client_id_present: !!clientId }
    });

    const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri,
        grant_type: "authorization_code",
        access_type: "offline",
      }),
    });

    const tokenJson = await tokenResp.json().catch(() => ({}));
    if (!tokenResp.ok) {
      // Audit: exchange fail
      await audit("exchange_fail", userId, { details: tokenJson });
      return htmlClose({
        source: "gdrive-oauth",
        ok: false,
        reason: "CODE_EXCHANGE_FAILED",
        details: tokenJson,
      });
    }

    const accessToken = tokenJson.access_token as string | undefined;
    let refreshToken = tokenJson.refresh_token as string | undefined | null;
    const expiresIn = (tokenJson.expires_in as number | undefined) ?? 3600;
    const scopeStr = (tokenJson.scope as string | undefined) ?? "";
    const expiresAt = new Date(Date.now() + (Math.max(expiresIn - 60, 60)) * 1000).toISOString();

    if (!state.userId || !accessToken) {
      return htmlClose({ source: "gdrive-oauth", ok: false, reason: "MISSING_USER_OR_TOKEN" });
    }

    // Audit: exchange success
    await audit("exchange_ok", state.userId, {
      has_access_token: !!accessToken,
      has_refresh_token: !!refreshToken,
      details: { scope: scopeStr, expires_in: expiresIn }
    });

    // Fallback de refresh_token (Google pode não enviar em reconsent)
    if (!refreshToken) {
      const existing = await getExistingTokenRow(state.userId);
      if (existing?.refresh_token_enc) {
        try { refreshToken = await decryptPacked(existing.refresh_token_enc); } catch {}
      }
    }

    try {
      await upsertTokens(
        state.userId,
        accessToken,
        refreshToken ?? null,
        scopeStr,
        expiresAt
      );

      // Audit: upsert success
      await audit("upsert_ok", state.userId, { 
        has_access_token: true, 
        has_refresh_token: !!(refreshToken) 
      });

      return htmlClose({ source: "gdrive-oauth", ok: true });
    } catch (upsertErr) {
      // Audit: upsert fail
      await audit("upsert_fail", state.userId, { 
        details: { error: String(upsertErr) } 
      });
      throw upsertErr;
    }
  } catch (err) {
    return htmlClose({ source: "gdrive-oauth", ok: false, reason: "UNEXPECTED", error: String(err) });
  }
});