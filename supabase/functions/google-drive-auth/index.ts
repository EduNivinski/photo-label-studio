import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- CORS (configurável por ENV) ---
const DEFAULT_ALLOWED = [
  "https://photo-label-studio.lovable.app",
  "http://localhost:3000",
  "http://localhost:5173",
  // adicione aqui seu sandbox atual, EXEMPLO:
  "https://a4888df3-b048-425b-8000-021ee0970cd7.sandbox.lovable.dev",
];

function allowedOrigins(): Set<string> {
  const csv = Deno.env.get("CORS_ALLOWED_ORIGINS");
  if (!csv) return new Set(DEFAULT_ALLOWED);
  return new Set(csv.split(",").map(s => s.trim()).filter(Boolean));
}

const ALLOW_ORIGINS = allowedOrigins();

function cors(origin: string | null) {
  const allowed = origin && ALLOW_ORIGINS.has(origin)
    ? origin
    : "https://photo-label-studio.lovable.app";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, x-supabase-authorization",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

// ✅ Helper de validação do JWT via supabase-js admin
async function getUserIdFromJwt(req: Request): Promise<string | null> {
  try {
    const auth = req.headers.get("authorization");
    if (!auth || !auth.startsWith("Bearer ")) return null;
    const token = auth.replace("Bearer ", "");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;
    return user.id;
  } catch {
    return null;
  }
}

const json = (req: Request, status: number, body: unknown) =>
  new Response(JSON.stringify(body), { 
    status, 
    headers: { 
      "Content-Type": "application/json", 
      ...cors(req.headers.get("origin")) 
    }
  });

// Simple JWT parser
function parseJwt(token: string): { sub?: string } {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload));
    return decoded;
  } catch {
    return {};
  }
}

// Action capture function
async function captureAction(req: Request, url: URL): Promise<string> {
  const path = url.pathname;
  
  // Check for callback in path or query params
  if (req.method === "GET" && (
    path.endsWith("/callback") || 
    url.searchParams.has("code")
  )) {
    return "callback";
  }
  
  // For POST requests, get action from body
  if (req.method === "POST") {
    try {
      const body = await req.json();
      return body.action || "unknown";
    } catch {
      return "unknown";
    }
  }
  
  return "unknown";
}

// Encryption/decryption functions
async function getEncryptionKey(): Promise<CryptoKey> {
  const keyData = Deno.env.get("TOKEN_ENC_KEY");
  if (!keyData) {
    throw new Error("TOKEN_ENC_KEY not found");
  }
  
  const keyBytes = new Uint8Array(Buffer.from(keyData, 'base64'));
  return await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encrypt(plaintext: string): Promise<string> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );
  
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

async function decrypt(encryptedData: string): Promise<string> {
  const key = await getEncryptionKey();
  const combined = new Uint8Array(atob(encryptedData).split('').map(c => c.charCodeAt(0)));
  
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);
  
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    encrypted
  );
  
  return new TextDecoder().decode(decrypted);
}

// Database functions
async function getEncryptedTokens(userId: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  
  const response = await fetch(`${supabaseUrl}/rest/v1/user_drive_tokens?user_id=eq.${userId}`, {
    headers: {
      "Authorization": `Bearer ${supabaseServiceKey}`,
      "apikey": supabaseServiceKey
    }
  });
  
  if (!response.ok) return null;
  
  const data = await response.json();
  return data.length > 0 ? data[0] : null;
}

async function decryptRow(row: any) {
  return {
    accessToken: await decrypt(row.access_token_enc),
    refreshToken: await decrypt(row.refresh_token_enc),
    expiresAt: row.expires_at,
    scopes: row.scope
  };
}

async function refreshGoogle(accessToken: string, refreshToken: string) {
  const clientId = Deno.env.get("GOOGLE_DRIVE_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GOOGLE_DRIVE_CLIENT_SECRET")!;
  
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    })
  });
  
  if (!response.ok) {
    return { ok: false };
  }
  
  const data = await response.json();
  return {
    ok: true,
    access_token: data.access_token,
    refresh_token: refreshToken, // Refresh token usually stays the same
    expiry_date: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
    scope: data.scope || ""
  };
}

async function saveTokensUpsert(userId: string, tokens: any) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  
  const encryptedAccess = await encrypt(tokens.access_token);
  const encryptedRefresh = await encrypt(tokens.refresh_token);
  
  const payload = {
    user_id: userId,
    access_token_enc: encryptedAccess,
    refresh_token_enc: encryptedRefresh,
    expires_at: tokens.expiry_date,
    scope: tokens.scope,
    updated_at: new Date().toISOString()
  };
  
  // Use UPSERT to avoid duplicate key errors
  const response = await fetch(`${supabaseUrl}/rest/v1/user_drive_tokens`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${supabaseServiceKey}`,
      "apikey": supabaseServiceKey,
      "Content-Type": "application/json",
      "Prefer": "resolution=merge-duplicates"
    },
    body: JSON.stringify(payload)
  });
  
  return response.ok;
}

async function getUserFolderId(userId: string): Promise<string | null> {
  // For now, return null - can be implemented later
  return null;
}

// Action handlers
async function handleCallback(req: Request, url: URL) {
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  
  const origin = req.headers.get("origin");
  
  if (error) {
    return new Response(`<h1>Google error</h1><p>${error}</p>`, { 
      status: 400, 
      headers: { "Content-Type": "text/html", ...cors(origin) } 
    });
  }
  
  if (!code || !stateRaw) {
    return json(req, 400, { ok: false, reason: "MISSING_CODE_OR_STATE" });
  }
  
  let state: any;
  try {
    state = JSON.parse(atob(stateRaw));
  } catch {
    return json(req, 400, { ok: false, reason: "INVALID_STATE" });
  }
  
  if (!state?.userId) {
    return json(req, 400, { ok: false, reason: "MISSING_USER_ID" });
  }
  
  const CLIENT_ID = Deno.env.get("GOOGLE_DRIVE_CLIENT_ID")!;
  const CLIENT_SECRET = Deno.env.get("GOOGLE_DRIVE_CLIENT_SECRET")!;
  const projectUrl = Deno.env.get("SUPABASE_URL")!.replace(/\/$/, "");
  // ✅ Use a função DEDICADA de callback (verify_jwt = false)
  const REDIRECT_URI = `${projectUrl}/functions/v1/google-drive-oauth-callback`;
  
  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
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
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token exchange failed:", errorText);
      return json(req, 500, { ok: false, reason: "TOKEN_EXCHANGE_FAILED" });
    }
    
    const tokens = await tokenResponse.json();
    const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();
    
    await saveTokensUpsert(state.userId, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: expiresAt,
      scope: tokens.scope || ""
    });
    
    const redirectUrl = state.redirect || "https://photo-label-studio.lovable.app/user";
    return new Response(null, {
      status: 303,
      headers: {
        Location: redirectUrl,
        ...cors(origin)
      }
    });
    
  } catch (error) {
    console.error("Callback error:", error);
    return json(req, 500, { ok: false, reason: "INTERNAL_ERROR" });
  }
}

async function handleStatus(req: Request, userId: string) {
  const row = await getEncryptedTokens(userId);
  if (!row) {
    return json(req, 200, { connected: false, reason: "NO_TOKENS" });
  }
  
  let { accessToken, refreshToken, expiresAt, scopes } = await decryptRow(row);
  
  // Check if token is expiring soon (30 seconds buffer)
  if (Date.now() > new Date(expiresAt).getTime() - 30_000) {
    const refreshed = await refreshGoogle(accessToken, refreshToken);
    if (!refreshed.ok) {
      return json(req, 200, { connected: false, reason: "EXPIRED" });
    }
    
    accessToken = refreshed.access_token;
    refreshToken = refreshed.refresh_token;
    expiresAt = refreshed.expiry_date;
    scopes = refreshed.scope;
    
    await saveTokensUpsert(userId, {
      access_token: accessToken,
      refresh_token: refreshToken,
      expiry_date: expiresAt,
      scope: scopes
    });
  }
  
  // Validate token with Google Drive API
  const driveResponse = await fetch("https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  
  if (driveResponse.status === 401 || driveResponse.status === 403) {
    return json(req, 200, { connected: false, reason: "TOKEN_INVALID" });
  }
  
  const { user } = await driveResponse.json();
  const expiresInSec = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  const scopesList = (scopes || "").split(/\s+/).filter(Boolean);
  const folderId = await getUserFolderId(userId);
  
  return json(req, 200, {
    connected: true,
    reason: "OK",
    email: user?.emailAddress || null,
    scopes: scopesList,
    expiresInSec,
    folderId: folderId || null
  });
}

async function handleAuthorize(req: Request, userId: string, url: URL) {
  const origin = req.headers.get("origin");
  const projectUrl = Deno.env.get("SUPABASE_URL")!.replace(/\/$/, "");
  const redirectUrl = origin ? `${origin}/user` : `${projectUrl}/user`;
  
  const state = btoa(JSON.stringify({
    userId,
    redirect: redirectUrl,
    nonce: crypto.randomUUID()
  }));
  
  // ✅ Use a função DEDICADA de callback (verify_jwt = false)
  const REDIRECT_URI = `${projectUrl}/functions/v1/google-drive-oauth-callback`;
  
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
  
  return json(req, 200, { 
    ok: true, 
    authorizeUrl, 
    redirect_uri: REDIRECT_URI 
  });
}

async function handleDisconnect(req: Request, userId: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  
  const response = await fetch(`${supabaseUrl}/rest/v1/user_drive_tokens?user_id=eq.${userId}`, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${supabaseServiceKey}`,
      "apikey": supabaseServiceKey
    }
  });
  
  return json(req, 200, { 
    ok: true, 
    message: "Disconnected successfully" 
  });
}

// Main handler
serve(async (req: Request) => {
  const origin = req.headers.get("origin");

  // 1) Preflight SEMPRE liberado (CORS)
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors(origin) });
  }

  // 2) Log básico de diagnóstico
  console.log("[google-drive-auth]", { method: req.method, origin, url: req.url });

  try {
    const url = new URL(req.url);
    const action = (await captureAction(req, url)) as "authorize" | "callback" | "status" | "disconnect";

    // 3) Callback não é processado aqui (há function dedicada)
    if (action === "callback") {
      return json(req, 400, { ok: false, reason: "CALLBACK_IS_EXTERNAL" });
    }

    // 4) Validar JWT manualmente para ações protegidas
    const userId = await getUserIdFromJwt(req);
    if (!userId) {
      return json(req, 401, { ok: false, reason: "INVALID_JWT" });
    }

    if (action === "status") return await handleStatus(req, userId);
    if (action === "authorize") return await handleAuthorize(req, userId, url);
    if (action === "disconnect") return await handleDisconnect(req, userId);

    return json(req, 400, { ok: false, reason: "UNKNOWN_ACTION" });

  } catch (e: any) {
    console.error("google-drive-auth error:", e?.message || e);
    return json(req, 500, { ok: false, reason: "INTERNAL_ERROR" });
  }
});