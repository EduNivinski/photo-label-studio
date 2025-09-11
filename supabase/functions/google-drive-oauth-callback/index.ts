import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { upsertTokens } from "../_shared/token_provider_v2.ts";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
  }
});

serve(async (req) => {
  if (req.method === "OPTIONS") return json(204, {});
  
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state"); // should contain user_id
    
    if (!code) return json(400, { status: 400, reason: "MISSING_CODE" });
    if (!state) return json(400, { status: 400, reason: "MISSING_STATE" });

    // Extract user_id from state (TODO: verify JWT if using signed state)
    const user_id = state;
    if (!user_id) return json(400, { status: 400, reason: "MISSING_USER_ID_IN_STATE" });

    // Exchange code for tokens with Google (server-side using secrets)
    const projectUrl = Deno.env.get("SUPABASE_URL")!.replace(/\/$/, "");
    const REDIRECT_URI = `${projectUrl}/functions/v1/google-drive-oauth-callback`;
    
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,              // ✅ EXATAMENTE o mesmo
        client_id: Deno.env.get("GOOGLE_DRIVE_CLIENT_ID")!,
        client_secret: Deno.env.get("GOOGLE_DRIVE_CLIENT_SECRET")!,
      }).toString(),
    });

    const tokenJson = await tokenResponse.json().catch(() => ({}));

    if (!tokenResponse.ok) {
      console.error("Code exchange failed:", tokenJson);
      return json(400, { status: 400, reason: "CODE_EXCHANGE_FAILED", detail: tokenJson?.error || tokenJson });
    }

    const access_token = tokenJson.access_token as string | undefined;
    const refresh_token = tokenJson.refresh_token as string | undefined;
    const scopeStr = (tokenJson.scope as string | undefined) ?? "";
    const expires_in = Number(tokenJson.expires_in ?? 0);

    if (!access_token) {
      return json(400, { status: 400, reason: "NO_ACCESS_TOKEN_FROM_GOOGLE" });
    }

    // Calculate expiration time (with 60s buffer)
    const expires_at = new Date(Date.now() + Math.max(0, expires_in - 60) * 1000).toISOString();

    // Persist tokens using service_role client
    try {
      await upsertTokens(user_id, access_token, refresh_token || null, scopeStr, expires_at);
      console.log(`OAuth callback successful for user ${user_id} - access_token length: ${access_token.length}`);
    } catch (e: any) {
      // Log internal error without exposing tokens
      console.error("DB_UPSERT_ERROR", { msg: e?.message, name: e?.name, user_id });
      return json(500, { status: 500, reason: "DB_UPSERT_ERROR", detail: e?.message });
    }

    // Success response with HTML auto-close
    const html = `<!doctype html>
<html>
  <head><meta charset="utf-8"><title>Google Drive Conectado</title></head>
  <body>
    <script>
      try {
        // Notifica a janela principal (opcional)
        if (window.opener) {
          window.opener.postMessage({ type: "drive_connected" }, "*");
        }
        // Fecha o popup
        window.close();
      } catch (e) { /* noop */ }
      // Fallback se não fechar
      setTimeout(function(){
        window.location.replace("/user");
      }, 300);
    </script>
    <div style="text-align: center; font-family: Arial, sans-serif; padding: 2rem;">
      <h1>✅ Google Drive conectado com sucesso!</h1>
      <p>Você pode fechar esta janela.</p>
    </div>
  </body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
      }
    });

  } catch (e: any) {
    console.error("OAUTH_CB_INTERNAL", { msg: e?.message, name: e?.name });
    
    // Error response with HTML auto-close
    const errorHtml = `<!doctype html>
<html>
  <head><meta charset="utf-8"><title>Erro na Conexão</title></head>
  <body>
    <script>
      try {
        // Notifica erro à janela principal
        if (window.opener) {
          window.opener.postMessage({ type: "drive_error", error: "INTERNAL_ERROR" }, "*");
        }
        // Fecha o popup
        window.close();
      } catch (e) { /* noop */ }
      // Fallback se não fechar
      setTimeout(function(){
        window.location.replace("/user");
      }, 300);
    </script>
    <div style="text-align: center; font-family: Arial, sans-serif; padding: 2rem;">
      <h1>❌ Erro na conexão</h1>
      <p>Ocorreu um erro interno. Você pode fechar esta janela e tentar novamente.</p>
    </div>
  </body>
</html>`;

    return new Response(errorHtml, {
      status: 500,
      headers: {
        "Content-Type": "text/html",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
      }
    });
  }
});