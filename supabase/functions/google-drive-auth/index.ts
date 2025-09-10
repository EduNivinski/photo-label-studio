import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { upsertTokens } from "../_shared/token_provider_v2.ts";

// CORS helper with all domains
const ALLOW_ORIGINS = new Set([
  "https://photo-label-studio.lovable.app",
  "https://a4888df3-b048-425b-8000-021ee0970cd7.sandbox.lovable.dev",
  "http://localhost:3000",
  "http://localhost:5173"
]);

function cors(origin: string | null) {
  const allowed = origin && ALLOW_ORIGINS.has(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allowed || "https://photo-label-studio.lovable.app",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Vary": "Origin",
  };
}

function json(status: number, body: unknown, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors(origin) }
  });
}

function html(status: number, body: string, origin: string | null) {
  return new Response(body, { 
    status, 
    headers: { "Content-Type": "text/html", ...cors(origin) } 
  });
}

function parseJwtSub(authHeader: string | null): string | null {
  try {
    if (!authHeader?.startsWith("Bearer ")) return null;
    const jwt = authHeader.slice(7);
    const payload = JSON.parse(atob(jwt.split(".")[1]));
    return payload.sub || null;
  } catch { 
    return null; 
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  // 1) Preflight sempre permitido
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors(origin) });
  }

  const url = new URL(req.url);
  // Suporta:
  //  - POST /functions/v1/google-drive-auth           (action: "authorize")
  //  - GET  /functions/v1/google-drive-auth/callback  (?code=..&state=..)
  const path = url.pathname.split("/").slice(4).join("/");

  try {
    // 2) Iniciar OAuth: requer usuário logado (JWT no Authorization)
    if (req.method === "POST" && (path === "" || path === "/")) {
      let body: any = {};
      try { 
        body = await req.json(); 
      } catch {
        return json(400, { ok: false, reason: "INVALID_JSON" }, origin);
      }
      
      if (body?.action !== "authorize") {
        return json(400, { ok: false, reason: "UNKNOWN_ACTION" }, origin);
      }

      const userId = parseJwtSub(req.headers.get("authorization"));
      if (!userId) {
        return json(401, { ok: false, reason: "NO_JWT" }, origin);
      }

      const redirect = String(body.redirect || "");
      if (!redirect) {
        return json(400, { ok: false, reason: "MISSING_REDIRECT" }, origin);
      }

      // Monte a URL de autorização do Google:
      const CLIENT_ID = Deno.env.get("GOOGLE_DRIVE_CLIENT_ID")!;
      const REDIRECT_URI = `${url.origin}/functions/v1/google-drive-auth/callback`;
      const scope = [
        "openid", "email", "profile",
        "https://www.googleapis.com/auth/drive.metadata.readonly",
        "https://www.googleapis.com/auth/drive.file"
      ].join(" ");

      // Proteção CSRF: empacote estado (inclui userId e redirect) + nonce
      const stateObj = { userId, redirect, nonce: crypto.randomUUID() };
      const state = btoa(JSON.stringify(stateObj));

      const authorizeUrl =
        `https://accounts.google.com/o/oauth2/v2/auth?` +
        new URLSearchParams({
          client_id: CLIENT_ID,
          redirect_uri: REDIRECT_URI,
          response_type: "code",
          access_type: "offline",
          include_granted_scopes: "false",
          prompt: "consent",
          scope,
          state
        }).toString();

      console.log(`✅ Generated authorize URL for user ${userId}`);
      return json(200, { ok: true, authorizeUrl }, origin);
    }

    // 3) Callback do Google: trocar code -> tokens, salvar e redirecionar
    if (req.method === "GET" && path === "callback") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const error = url.searchParams.get("error");
      
      if (error) {
        return html(400, `<html><body><h1>Google Drive Error</h1><p>${error}</p></body></html>`, origin);
      }
      
      if (!code || !state) {
        return html(400, `<html><body><h1>Missing code/state</h1></body></html>`, origin);
      }

      // Validar state
      let st: any = null;
      try { 
        st = JSON.parse(atob(state)); 
      } catch {
        return html(400, `<html><body><h1>Invalid state format</h1></body></html>`, origin);
      }
      
      if (!st?.userId || !st?.redirect) {
        return html(400, `<html><body><h1>Invalid state content</h1></body></html>`, origin);
      }

      // Trocar code por tokens
      const CLIENT_ID = Deno.env.get("GOOGLE_DRIVE_CLIENT_ID")!;
      const CLIENT_SECRET = Deno.env.get("GOOGLE_DRIVE_CLIENT_SECRET")!;
      const REDIRECT_URI = `${url.origin}/functions/v1/google-drive-auth/callback`;

      console.log(`🔄 Exchanging code for tokens for user ${st.userId}`);
      
      const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code, 
          client_id: CLIENT_ID, 
          client_secret: CLIENT_SECRET,
          redirect_uri: REDIRECT_URI, 
          grant_type: "authorization_code"
        })
      });

      if (!tokenResp.ok) {
        const errorText = await tokenResp.text();
        console.error(`❌ Token exchange failed: ${errorText}`);
        return html(500, `<html><body><h1>Token exchange failed</h1><pre>${errorText}</pre></body></html>`, origin);
      }
      
      const tokens = await tokenResp.json();
      console.log(`✅ Tokens received for user ${st.userId}`);

      // Salvar tokens usando o token_provider_v2
      try {
        const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();
        const scopeString = tokens.scope || scope;
        
        await upsertTokens(st.userId, tokens.access_token, tokens.refresh_token, scopeString, expiresAt);
        console.log(`✅ Tokens saved for user ${st.userId}`);
      } catch (saveError) {
        console.error(`❌ Failed to save tokens: ${saveError}`);
        return html(500, `<html><body><h1>Failed to save tokens</h1><p>${saveError}</p></body></html>`, origin);
      }

      // Redirecionar de volta para a UI
      const backUrl = st.redirect;
      return html(200, `
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Google Drive Connected</title>
        </head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1 style="color: #4CAF50;">✓ Google Drive Conectado!</h1>
          <p>Redirecionando...</p>
          <script>
            if (window.opener) {
              window.opener.location.href = ${JSON.stringify(backUrl)};
              window.close();
            } else {
              window.location.href = ${JSON.stringify(backUrl)};
            }
          </script>
        </body>
        </html>
      `, origin);
    }

    return json(404, { ok: false, reason: "NOT_FOUND", path }, origin);

  } catch (error) {
    console.error('❌ Error in google-drive-auth:', error);
    return json(500, { 
      ok: false, 
      reason: "INTERNAL_ERROR", 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, origin);
  }
});