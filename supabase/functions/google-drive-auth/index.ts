import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { upsertTokens, getUserTokensRow, decryptPacked, ensureAccessToken } from "../_shared/token_provider_v2.ts";

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

// Helper functions for user_drive_settings
async function upsertUserDriveSettings(userId: string, folderId: string, folderName: string) {
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const { error } = await admin
    .from("user_drive_settings")
    .upsert({
      user_id: userId,
      drive_folder_id: folderId,
      drive_folder_name: folderName,
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id" });

  if (error) throw new Error(`DB_UPSERT_SETTINGS: ${error.message}`);
}

async function getUserDriveSettings(userId: string) {
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const { data, error } = await admin
    .from("user_drive_settings")
    .select("drive_folder_id, drive_folder_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`DB_GET_SETTINGS: ${error.message}`);
  return data || null;
}

// Helper para extrair action do query ou body
async function getAction(req: Request, url: URL): Promise<string> {
  // 1) tenta query string
  const q = url.searchParams.get("action");
  if (q) return q;

  // 2) tenta body JSON (sem quebrar req.json() futuro)
  if (req.method !== "GET") {
    try {
      const ct = req.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const data = await req.json();
        return (data && typeof data.action === "string") ? data.action : "";
      }
    } catch (_) { /* ignore */ }
  }
  return "";
}

async function handleStatus(req: Request, userId: string) {
  try {
    const token = await ensureAccessToken(userId);
    const settings = await getUserDriveSettings(userId);
    return json(req, 200, {
      ok: true,
      connected: true,
      hasConnection: true,
      isExpired: false,
      dedicatedFolderId: settings?.drive_folder_id ?? null,
      dedicatedFolderName: settings?.drive_folder_name ?? null,
    });
  } catch (e: any) {
    const reason = (e?.message || "").toUpperCase();
    return json(req, 200, { ok: true, connected: false, hasConnection: false, isExpired: true, reason: reason || "EXPIRED_OR_INVALID" });
  }
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

async function handleSetFolder(req: Request, userId: string, body: any) {
  try {
    const folderId = body?.folderId?.toString?.() || "";
    const folderNameIn = body?.folderName?.toString?.() || "";
    if (!folderId) return json(req, 400, { ok: false, reason: "MISSING_FOLDER_ID" });

    // ✅ Validar que é uma pasta válida no Drive
    const accessToken = await ensureAccessToken(userId);
    const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?fields=id,name,mimeType,trashed`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const meta = await metaRes.json().catch(() => ({}));
    if (!metaRes.ok) {
      return json(req, 400, { ok: false, reason: "FOLDER_LOOKUP_FAILED", details: meta });
    }
    if (meta.trashed) return json(req, 400, { ok: false, reason: "FOLDER_TRASHED" });
    if (meta.mimeType !== "application/vnd.google-apps.folder") {
      return json(req, 400, { ok: false, reason: "NOT_A_FOLDER" });
    }

    const finalName = folderNameIn || meta.name || "Pasta sem nome";
    await upsertUserDriveSettings(userId, folderId, finalName);

    return json(req, 200, {
      ok: true,
      dedicatedFolderId: folderId,
      dedicatedFolderName: finalName,
    });
  } catch (e: any) {
    return json(req, 500, { ok: false, reason: "SET_FOLDER_ERROR", message: e?.message || String(e) });
  }
}

async function getUserIdFromJwt(req: Request): Promise<string | null> {
  const jwt = getBearer(req);
  if (!jwt) return null;
  
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: { user }, error } = await admin.auth.getUser(jwt);
  return error || !user ? null : user.id;
}

serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  const url = new URL(req.url);
  const pathname = url.pathname || "";
  
  // callback não é tratado aqui
  if (pathname.endsWith("/callback")) {
    return await handleCallback(req, url);
  }

  // ✅ Ler body JSON UMA única vez (se houver)
  let body: any = null;
  if (req.method !== "GET") {
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      try { body = await req.json(); } catch (_) { body = null; }
    }
  }

  // ✅ Extrair action da query OU do body lido
  const action = url.searchParams.get("action") || body?.action || "";
  console.log("[google-drive-auth] action:", action);

  try {
    if (action === "callback") {
      return json(req, 400, { ok: false, reason: "CALLBACK_IS_EXTERNAL" });
    }

    // valida JWT manualmente (já que verify_jwt=false no config)
    const userId = await getUserIdFromJwt(req);
    if (!userId && action !== "") {
      return json(req, 401, { ok: false, reason: "INVALID_JWT" });
    }

    if (action === "status") return await handleStatus(req, userId!);
    if (action === "authorize") return await handleAuthorize(req, userId!, url);
    
    // ✅ Passar o body JÁ LIDO ao set_folder
    if (action === "set_folder") return await handleSetFolder(req, userId!, body);
    
    if (action === "setFolder") {
      const folderId = body?.folderId?.toString?.() || "";
      const folderName = body?.folderName?.toString?.() || "";
      if (!folderId) return json(req, 400, { ok: false, reason: "MISSING_FOLDER_ID" });

      const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { error: eUpd } = await admin
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

    // default (quando sem action)
    return json(req, 200, { ok: true, message: "google-drive-auth ready" });
  } catch (e: any) {
    console.error("google-drive-auth error:", e?.message || e);
    return json(req, 500, { ok: false, reason: "INTERNAL_ERROR" });
  }
});