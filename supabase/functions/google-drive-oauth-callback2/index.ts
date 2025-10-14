import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { upsertTokens } from "../_shared/token_provider_v2.ts";

const ORIGIN = "https://photo-label-studio.lovable.app";
const H = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Headers": "content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function getAdmin() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("ENV_MISSING_SUPABASE_SERVICE_ROLE");
  return createClient(url, key);
}

serve(async (req) => {
  console.log("[google-drive-oauth-callback2] Request received", { 
    method: req.method, 
    url: req.url 
  });

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: H });
  }

  try {
    const traceId = crypto.randomUUID();
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    // Validate required parameters
    if (!code) {
      console.error("[callback] Missing code parameter");
      return new Response(
        JSON.stringify({ ok: false, reason: "BAD_CODE" }),
        { status: 400, headers: { ...H, "Content-Type": "application/json" } }
      );
    }

    if (!state) {
      console.error("[callback] Missing state parameter");
      return new Response(
        JSON.stringify({ ok: false, reason: "BAD_STATE" }),
        { status: 400, headers: { ...H, "Content-Type": "application/json" } }
      );
    }

    // Validate state and get user_id
    const admin = getAdmin();
    const { data: stateData, error: stateErr } = await admin
      .from("oauth_state")
      .select("user_id, expires_at")
      .eq("state", state)
      .maybeSingle();

    if (stateErr || !stateData) {
      console.error("[callback] Invalid state:", { error: stateErr?.message });
      return new Response(
        JSON.stringify({ ok: false, reason: "INVALID_STATE" }),
        { status: 400, headers: { ...H, "Content-Type": "application/json" } }
      );
    }

    // Check if state expired
    if (new Date(stateData.expires_at).getTime() < Date.now()) {
      console.error("[callback] State expired");
      await admin.from("oauth_state").delete().eq("state", state);
      return new Response(
        JSON.stringify({ ok: false, reason: "STATE_EXPIRED" }),
        { status: 400, headers: { ...H, "Content-Type": "application/json" } }
      );
    }

    // Get OAuth credentials
    const clientId = Deno.env.get("GOOGLE_DRIVE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_DRIVE_CLIENT_SECRET");
    const redirectUri = Deno.env.get("GDRIVE_REDIRECT_URI");

    if (!clientId || !clientSecret || !redirectUri) {
      console.error("[callback] Missing OAuth config");
      throw new Error("OAUTH_CONFIG_MISSING");
    }

    // Exchange code for tokens
    console.log("[callback] Exchanging code for tokens");
    const tokenBody = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    });

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      console.error("[callback] Token exchange failed:", errorData);
      throw new Error("TOKEN_EXCHANGE_FAILED");
    }

    const tokens = await tokenResponse.json();
    console.log("[callback] Tokens received", {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiresIn: tokens.expires_in
    });

    // Calculate expires_at
    const expiresAtIso = new Date(
      Date.now() + Math.max(0, (tokens.expires_in ?? 3600) - 60) * 1000
    ).toISOString();

    // Store tokens using the existing secure provider
    await upsertTokens(
      stateData.user_id,
      tokens.access_token,
      tokens.refresh_token || "",
      tokens.scope || "",
      expiresAtIso
    );

    console.log("[callback] Tokens stored successfully");

    // Update user_drive_settings with granted scope only (do not touch drive_folder_*)
    if (tokens.scope) {
      console.log("[uds-write]", { traceId, user_id: stateData.user_id, fieldsTouched: ["scope_granted","updated_at"], caller: "google-drive-oauth-callback2" });
      const { error: udsErr } = await admin
        .from("user_drive_settings")
        .update({
          scope_granted: tokens.scope,
          updated_at: new Date().toISOString()
        })
        .eq("user_id", stateData.user_id);
      if (udsErr) {
        console.warn("[callback] Failed to update scope_granted:", udsErr.message);
      }
    }

    // Clean up used state
    await admin.from("oauth_state").delete().eq("state", state);

    // Return success page that closes the window and notifies parent
    const html = `<!doctype html>
<meta charset="utf-8" />
<script>
  try {
    if (window.opener) {
      window.opener.postMessage({ type: "drive_connected" }, "${ORIGIN}");
      setTimeout(() => window.close(), 500);
    }
  } catch (e) {
    console.error("Failed to notify parent:", e);
  }
</script>
<body style="font-family:system-ui;margin:24px;text-align:center">
  <h2>✓ Conexão realizada com sucesso</h2>
  <p>Você pode fechar esta janela.</p>
  <script>setTimeout(() => window.close(), 2000);</script>
</body>`;

    return new Response(html, {
      status: 200,
      headers: { ...H, "Content-Type": "text/html; charset=utf-8" }
    });

  } catch (e: any) {
    console.error("[callback] Error:", {
      message: e?.message || "CALLBACK_ERR",
      stack: e?.stack
    });

    const msg = e?.message || "CALLBACK_ERR";
    const code = /state/i.test(msg) ? 400 : 500;

    return new Response(
      JSON.stringify({ ok: false, reason: msg }),
      { 
        status: code, 
        headers: { ...H, "Content-Type": "application/json" } 
      }
    );
  }
});
