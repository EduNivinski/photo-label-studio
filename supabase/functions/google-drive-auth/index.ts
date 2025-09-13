import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { upsertTokens, getUserTokensRow, decryptPacked } from "../_shared/token_provider_v2.ts";

// CORS helper
const DEFAULT_ALLOWED = [
  "https://photo-label-studio.lovable.app",
  "http://localhost:3000",
  "http://localhost:5173",
];
const ALLOW = new Set(
  (Deno.env.get("CORS_ALLOWED_ORIGINS")?.split(",") ?? DEFAULT_ALLOWED)
    .map(s => s.trim()).filter(Boolean)
);
function corsHeaders(req: Request) {
  const origin = req.headers.get("origin");
  const allowed = origin && ALLOW.has(origin) ? origin : "https://photo-label-studio.lovable.app";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Vary": "Origin",
  } as const;
}

const json = (req: Request, status: number, body: unknown) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", ...corsHeaders(req) }
});

function getBearer(req: Request): string | null {
  const a = req.headers.get("authorization");
  if (a && /^Bearer\s+/i.test(a)) return a.replace(/^Bearer\s+/i, "");
  return null;
}

async function handleCallback(req: Request, url: URL) {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return new Response(`
      <!DOCTYPE html>
      <html><head><title>Authorization Error</title></head>
      <body>
        <h1>Authorization Error</h1>
        <p>Error: ${error}</p>
        <p><a href="/">Return to app</a></p>
      </body></html>
    `, { headers: { "Content-Type": "text/html" } });
  }

  if (!code || !state) {
    return new Response(`
      <!DOCTYPE html>
      <html><head><title>Missing Parameters</title></head>
      <body>
        <h1>Missing Parameters</h1>
        <p>Missing code or state parameter</p>
        <p><a href="/">Return to app</a></p>
      </body></html>
    `, { headers: { "Content-Type": "text/html" } });
  }

  try {
    const { userId, r: redirect } = JSON.parse(atob(state));
    
    // Exchange code for tokens
    const CLIENT_ID = Deno.env.get("GOOGLE_DRIVE_CLIENT_ID");
    const CLIENT_SECRET = Deno.env.get("GOOGLE_DRIVE_CLIENT_SECRET");
    const REDIRECT_URI = Deno.env.get("GOOGLE_REDIRECT_URI");

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID!,
        client_secret: CLIENT_SECRET!,
        code,
        grant_type: "authorization_code",
        redirect_uri: REDIRECT_URI!,
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) {
      throw new Error(`Token exchange failed: ${tokenData.error_description || tokenData.error}`);
    }

    const { access_token, refresh_token, expires_in, scope } = tokenData;

    // Get existing tokens to preserve refresh_token if not provided
    const existing = await getUserTokensRow(userId);
    let oldRefresh: string | null = null;
    if (existing?.refresh_token_enc) {
      try { 
        oldRefresh = await decryptPacked(existing.refresh_token_enc); 
      } catch { 
        oldRefresh = null; 
      }
    }

    // Decide final refresh token
    const finalRefresh = (refresh_token && refresh_token.trim().length > 0) ? refresh_token : oldRefresh;

    if (!finalRefresh) {
      return new Response(`
        <!DOCTYPE html>
        <html><head><title>Reconnection Required</title></head>
        <body>
          <h1>Reconnection Required</h1>
          <p>Please reconnect with permissions to complete the setup.</p>
          <p><a href="${redirect || '/'}">Return to app</a></p>
        </body></html>
      `, { headers: { "Content-Type": "text/html" } });
    }

    // Calculate expires_at with 60s buffer
    const expiresAtIso = new Date(Date.now() + Math.max(0, (expires_in ?? 3600) - 60) * 1000).toISOString();

    // Save tokens (preserving old refresh if new one not provided)
    await upsertTokens(
      userId,
      access_token,
      finalRefresh,
      Array.isArray(scope) ? scope.join(" ") : String(scope || ""),
      expiresAtIso
    );

    return new Response(`
      <!DOCTYPE html>
      <html><head><title>Authorization Complete</title></head>
      <body>
        <h1>Authorization Complete</h1>
        <p>Google Drive has been connected successfully!</p>
        <script>
          setTimeout(() => {
            window.location.href = "${redirect || '/'}";
          }, 2000);
        </script>
        <p><a href="${redirect || '/'}">Continue to app</a></p>
      </body></html>
    `, { headers: { "Content-Type": "text/html" } });

  } catch (e: any) {
    console.error("Callback error:", e);
    return new Response(`
      <!DOCTYPE html>
      <html><head><title>Authorization Error</title></head>
      <body>
        <h1>Authorization Error</h1>
        <p>Error: ${e.message}</p>
        <p><a href="/">Return to app</a></p>
      </body></html>
    `, { headers: { "Content-Type": "text/html" } });
  }
}

async function handleAuthorize(req: Request, userId: string, url: URL) {
  const body = await req.json().catch(() => ({}));
  const redirect = body.redirect || url.searchParams.get("redirect") || (new URL("/settings/drive", url.origin).toString());
  const force = !!(body.forceConsent || url.searchParams.get("forceConsent") === "true");
  const state = btoa(JSON.stringify({ userId, r: redirect }));

  const CLIENT_ID = Deno.env.get("GOOGLE_DRIVE_CLIENT_ID");
  const REDIRECT_URI = Deno.env.get("GOOGLE_REDIRECT_URI");
  if (!CLIENT_ID || !REDIRECT_URI) return json(req, 500, { ok:false, error: "Missing Google OAuth configuration" });

  const SCOPE = [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/drive.readonly",
  ].join(" ");

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: force ? "consent select_account" : "select_account",
    scope: SCOPE,
    state,
  });

  const authorizeUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  return json(req, 200, { ok: true, authorizeUrl, redirect_uri: REDIRECT_URI });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  try {
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const action = body.action || url.searchParams.get("action");

    // Handle OAuth callback
    if (url.pathname.includes("/callback") || url.searchParams.has("code")) {
      return await handleCallback(req, url);
    }

    // Set folder action (manual JWT validation)
    if (action === "setFolder") {
      const token = getBearer(req);
      if (!token) return json(req, 401, { ok: false, reason: "MISSING_AUTH" });
      
      const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: { user }, error: eUser } = await supa.auth.getUser(token);
      if (eUser || !user) return json(req, 401, { ok: false, reason: "INVALID_JWT" });

      const { folderId, folderName } = body || {};
      if (!folderId) return json(req, 400, { ok: false, reason: "MISSING_FOLDER_ID" });

      const userId = user.id;

      const { error: eUpd } = await supa
        .from("user_drive_tokens")
        .update({
          dedicated_folder_id: folderId,
          dedicated_folder_name: folderName ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (eUpd) return json(req, 500, { ok: false, reason: "FOLDER_UPDATE_FAILED", detail: eUpd.message });

      return json(req, 200, { ok: true, dedicatedFolderId: folderId, dedicatedFolderName: folderName ?? null });
    }

    // Authorize flow (manual JWT validation because verify_jwt=false)
    if (action === "authorize") {
      const token = getBearer(req);
      if (!token) return json(req, 401, { ok:false, error: "Missing authorization token" });
      const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: { user }, error } = await supa.auth.getUser(token);
      if (error || !user) return json(req, 401, { ok:false, error: "Invalid token" });
      return await handleAuthorize(req, user.id, url);
    }

    // Fallback: return basic info for health check
    return json(req, 200, { ok:true, message: "google-drive-auth ready" });
  } catch (e: any) {
    console.error("google-drive-auth error:", e?.message);
    return json(req, 500, { ok:false, error: e?.message || "Internal error" });
  }
});