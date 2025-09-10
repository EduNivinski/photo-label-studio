import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { upsertTokens } from "../_shared/token_provider_v2.ts";

const ALLOW_ORIGINS = new Set([
  "https://photo-label-studio.lovable.app",
  "https://a4888df3-b048-425b-8000-021ee0970cd7.sandbox.lovable.dev",
  "http://localhost:3000",
  "http://localhost:5173",
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

const j = (s: number, b: unknown, o: string | null) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json", ...cors(o) }});

const h = (s: number, b: string, o: string | null) =>
  new Response(b, { status: s, headers: { "Content-Type": "text/html", ...cors(o) }});

function subFromAuth(hd: string | null): string | null {
  try {
    if (!hd?.startsWith("Bearer ")) return null;
    const jwt = hd.slice(7);
    const p = JSON.parse(atob(jwt.split(".")[1]));
    return p?.sub || null;
  } catch { return null; }
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  // Preflight sempre permitido
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });

  const url = new URL(req.url);
  const subpath = url.pathname.split("/").slice(4).join("/"); // depois de /functions/v1/google-drive-auth

  try {
    // POST /functions/v1/google-drive-auth  (pedir authorizeUrl)
    if (req.method === "POST" && (subpath === "" || subpath === "/")) {
      let body: any = {};
      try { body = await req.json(); } catch {}
      if (body?.action !== "authorize") return j(400, { ok:false, reason:"UNKNOWN_ACTION" }, origin);

      const userId = subFromAuth(req.headers.get("authorization"));
      if (!userId) return j(401, { ok:false, reason:"NO_JWT" }, origin);

      const redirect = String(body.redirect || "");
      if (!redirect) return j(400, { ok:false, reason:"MISSING_REDIRECT" }, origin);

    // Cálculo robusto do origin (sempre https)
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    const originHttps = host ? `https://${host}` : "https://tcupxcxyylxfgsbhfdhw.supabase.co"; // fallback seguro
    const REDIRECT_URI = `${originHttps}/functions/v1/google-drive-auth/callback`;

    const CLIENT_ID = Deno.env.get("GOOGLE_DRIVE_CLIENT_ID")!;

    const scope = [
      "openid","email","profile",
      "https://www.googleapis.com/auth/drive.metadata.readonly",
      "https://www.googleapis.com/auth/drive.file"
    ].join(" ");

    const stateObj = { userId, redirect, nonce: crypto.randomUUID() };
    const state = btoa(JSON.stringify(stateObj)); // pode trocar por HMAC assinado

    const authorizeUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: "code",
        access_type: "offline",
        include_granted_scopes: "false",
        prompt: "consent select_account",
        scope,
        state
      }).toString();

      console.log(`✅ Generated authorize URL for user ${userId}`);
      return j(200, { ok:true, authorizeUrl }, origin);
    }

    // GET /functions/v1/google-drive-auth/callback  (troca code -> tokens)
    if (req.method === "GET" && subpath === "callback") {
      const code  = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const err   = url.searchParams.get("error");
      if (err) return h(400, `<h1>Google error</h1><p>${err}</p>`, origin);
      if (!code || !state) return h(400, `<h1>Missing code/state</h1>`, origin);

      let st: any = null;
      try { st = JSON.parse(atob(state)); } catch {}
      if (!st?.userId || !st?.redirect) return h(400, `<h1>Invalid state</h1>`, origin);

      // Cálculo robusto do origin para callback também
      const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
      const originHttps = host ? `https://${host}` : "https://tcupxcxyylxfgsbhfdhw.supabase.co";
      
      const CLIENT_ID = Deno.env.get("GOOGLE_DRIVE_CLIENT_ID")!;
      const CLIENT_SECRET = Deno.env.get("GOOGLE_DRIVE_CLIENT_SECRET")!;
      const REDIRECT_URI = `${originHttps}/functions/v1/google-drive-auth/callback`;

      console.log(`🔄 Exchanging code for tokens for user ${st.userId}`);

      const tr = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
          redirect_uri: REDIRECT_URI, grant_type: "authorization_code"
        })
      });
      
      if (!tr.ok) {
        const errorText = await tr.text();
        console.error(`❌ Token exchange failed: ${errorText}`);
        return h(500, `<h1>Token exchange failed</h1><pre>${errorText}</pre>`, origin);
      }
      
      const tokens = await tr.json();
      console.log(`✅ Tokens received for user ${st.userId}`);

      // Salvar tokens via token_provider_v2
      try {
        const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();
        const scopeString = tokens.scope || scope;
        
        await upsertTokens(st.userId, tokens.access_token, tokens.refresh_token, scopeString, expiresAt);
        console.log(`✅ Tokens saved for user ${st.userId}`);
      } catch (saveError) {
        console.error(`❌ Failed to save tokens: ${saveError}`);
        return h(500, `<h1>Failed to save tokens</h1><pre>${saveError}</pre>`, origin);
      }

      // Redirecionar de volta pra /user
      const back = st.redirect || `${url.origin}/user`;
      return h(200, `
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
              window.opener.location.href = ${JSON.stringify(back)};
              window.close();
            } else {
              window.location.href = ${JSON.stringify(back)};
            }
          </script>
        </body>
        </html>
      `, origin);
    }

    return j(404, { ok:false, reason:"NOT_FOUND", subpath }, origin);

  } catch (error) {
    console.error('❌ Error in google-drive-auth:', error);
    return j(500, { 
      ok:false, 
      reason:"INTERNAL_ERROR", 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, origin);
  }
});