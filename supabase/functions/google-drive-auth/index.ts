import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { upsertTokens } from "../_shared/token_provider_v2.ts";

Deno.serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const path = url.pathname;
  const origin = req.headers.get("origin");

  // O callback pode chegar como /functions/v1/google-drive-auth/callback
  // ou como /functions/v1/google-drive-auth?code=... (dependendo do roteamento).
  const isCallback =
    req.method === "GET" && (
      path.endsWith("/google-drive-auth/callback") ||
      (path.endsWith("/google-drive-auth") && url.searchParams.has("code"))
    );

  // CORS básico
  const ALLOW = new Set([
    "https://photo-label-studio.lovable.app",
    "https://a4888df3-b048-425b-8000-021ee0970cd7.sandbox.lovable.dev",
    "http://localhost:3000",
    "http://localhost:5173",
  ]);
  const cors = (o: string | null) => ({
    "Access-Control-Allow-Origin": (o && ALLOW.has(o)) ? o : "https://photo-label-studio.lovable.app",
    "Access-Control-Allow-Headers": "authorization, content-type, x-client-info",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Vary": "Origin",
  });
  const json = (s: number, b: unknown) => new Response(JSON.stringify(b), {
    status: s, headers: { "Content-Type": "application/json", ...cors(origin) }
  });
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors(origin) });
  }

  // 🔑 IMPORTANTÍSSIMO: NÃO EXIGIR Authorization NO CALLBACK
  if (!isCallback) {
    const auth = req.headers.get("authorization");
    if (!auth) return json(401, { code: 401, message: "Missing authorization header" });
  }

  function subFromAuth(hd: string | null): string | null {
    try {
      if (!hd?.startsWith("Bearer ")) return null;
      const jwt = hd.slice(7);
      const p = JSON.parse(atob(jwt.split(".")[1]));
      return p?.sub || null;
    } catch { return null; }
  }

  // Evitar "edge-runtime": construir redirect a partir do SUPABASE_URL
  const projectUrl = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "")
    || "https://tcupxcxyylxfgsbhfdhw.supabase.co";
  const REDIRECT_URI = `${projectUrl}/functions/v1/google-drive-auth/callback`;

  // 🔎 Log leve para diagnóstico (pode remover depois)
  console.log("gd-auth dbg:", { path, method: req.method, isCallback, hasCode: url.searchParams.has("code") });

  // Roteamento
  if (isCallback) {
    // GET /callback (ou GET /google-drive-auth?code=...)
    const code = url.searchParams.get("code");
    const stateRaw = url.searchParams.get("state");
    const err = url.searchParams.get("error");
    
    if (err) return new Response(`<h1>Google error</h1><p>${err}</p>`, { 
      status: 400, 
      headers: { "Content-Type": "text/html", ...cors(origin) } 
    });
    
    if (!code) return json(400, { code: 400, reason: "MISSING_CODE" });
    if (!stateRaw) return json(400, { code: 400, reason: "MISSING_STATE" });

    let st: any = null;
    try { st = JSON.parse(atob(stateRaw)); } catch {}
    if (!st?.userId || !st?.redirect) {
      return new Response(`<h1>Invalid state</h1>`, { 
        status: 400, 
        headers: { "Content-Type": "text/html", ...cors(origin) } 
      });
    }

    const CLIENT_ID = Deno.env.get("GOOGLE_DRIVE_CLIENT_ID")!;
    const CLIENT_SECRET = Deno.env.get("GOOGLE_DRIVE_CLIENT_SECRET")!;

    console.log(`🔄 Exchanging code for tokens for user ${st.userId}`);

    try {
      const tr = await fetch("https://oauth2.googleapis.com/token", {
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
      
      if (!tr.ok) {
        const errorText = await tr.text();
        console.error(`❌ Token exchange failed: ${errorText}`);
        return new Response(`<h1>Token exchange failed</h1><pre>${errorText}</pre>`, { 
          status: 500, 
          headers: { "Content-Type": "text/html", ...cors(origin) } 
        });
      }
      
      const tokens = await tr.json();
      console.log(`✅ Tokens received for user ${st.userId}`);

      // Salvar tokens via token_provider_v2
      const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();
      const scope = [
        "openid","email","profile",
        "https://www.googleapis.com/auth/drive.metadata.readonly",
        "https://www.googleapis.com/auth/drive.file"
      ].join(" ");
      const scopeString = tokens.scope || scope;
      
      await upsertTokens(st.userId, tokens.access_token, tokens.refresh_token, scopeString, expiresAt);
      console.log(`✅ Tokens saved for user ${st.userId}`);

      // Redirecionar de volta para a UI
      const redirect = st.redirect;
      return new Response(null, { 
        status: 303, 
        headers: { 
          Location: redirect,
          ...cors(origin)
        }
      });
    } catch (error) {
      console.error(`❌ Error in callback: ${error}`);
      return new Response(`<h1>Failed to save tokens</h1><pre>${error}</pre>`, { 
        status: 500, 
        headers: { "Content-Type": "text/html", ...cors(origin) } 
      });
    }
  }

  // POST /google-drive-auth { action: "authorize" | "status" | "reset" ... }
  if (req.method === "POST" && path.endsWith("/google-drive-auth")) {
    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action === "authorize") {
      const userId = subFromAuth(req.headers.get("authorization"));
      if (!userId) return json(401, { ok: false, reason: "NO_JWT" });

      const redirect = body?.redirect || (origin ? origin + "/user" : (projectUrl + "/user"));
      const stateObj = { userId, redirect, nonce: crypto.randomUUID() };
      const state = btoa(JSON.stringify(stateObj));

      const params = new URLSearchParams({
        client_id: Deno.env.get("GOOGLE_DRIVE_CLIENT_ID")!,
        redirect_uri: REDIRECT_URI,
        response_type: "code",
        access_type: "offline",
        include_granted_scopes: "false",
        prompt: "consent select_account",
        scope: "openid email profile https://www.googleapis.com/auth/drive.metadata.readonly https://www.googleapis.com/auth/drive.file",
        state
      });
      const authorizeUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
      
      console.log("[gd-auth] using redirect_uri =", REDIRECT_URI);
      console.log(`✅ Generated authorize URL for user ${userId}`);
      
      return json(200, { ok: true, authorizeUrl, redirect_uri: REDIRECT_URI });
    }

    // ...demais ações (status, reset etc) que exigem Authorization seguem aqui...
  }

  return json(404, { code: 404, message: "Not found" });
});