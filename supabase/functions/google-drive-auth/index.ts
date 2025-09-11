import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { preflight, jsonCors } from "../_shared/cors.ts";

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

// Removed - using jsonCors from shared helper

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

// Use shared token provider functions (already uses Service Role internally)
import { getTokens, upsertTokens, deleteTokens, ensureAccessToken } from "../_shared/token_provider_v2.ts";

async function getEncryptedTokens(userId: string) {
  try {
    return await getTokens(userId);
  } catch (error) {
    console.error("Error fetching tokens:", error);
    return null;
  }
}

// No longer need decryptRow since getTokens() already returns decrypted values

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
  try {
    await upsertTokens(
      userId,
      tokens.access_token,
      tokens.refresh_token,
      tokens.scope || "",
      tokens.expiry_date
    );
    return true;
  } catch (error) {
    console.error("Error saving tokens:", error);
    return false;
  }
}

async function getUserFolderId(userId: string): Promise<string | null> {
  // For now, return null - can be implemented later
  return null;
}

// Action handlers (callback removed - handled by dedicated function)

async function handleStatus(req: Request, userId: string) {
  try {
    const token = await ensureAccessToken(userId);
    if (!token) throw new Error("NO_ACCESS_TOKEN");
    return jsonCors(req, 200, { ok: true, connected: true });
  } catch (e: any) {
    const msg = (e?.message || "").toUpperCase();

    // Normaliza mensagens comuns:
    let reason = "EXPIRED_OR_INVALID";
    if (msg.includes("NO_TOKENS")) reason = "NO_TOKENS";
    else if (msg.includes("NO_REFRESH_TOKEN")) reason = "NO_REFRESH_TOKEN";
    else if (msg.includes("OAUTH_REFRESH_FAILED")) reason = msg; // traz OAUTH_REFRESH_FAILED:XXXX
    else if (msg.includes("NO_ACCESS_TOKEN_AFTER_REFRESH")) reason = "NO_ACCESS_TOKEN_AFTER_REFRESH";

    return jsonCors(req, 200, { ok: true, connected: false, reason });
  }
}

async function handleAuthorize(req: Request, userId: string, url: URL) {
  const origin = req.headers.get("origin");
  const projectUrl = Deno.env.get("SUPABASE_URL")!.replace(/\/$/, "");
  const redirectUrl = origin ? `${origin}/user` : `${projectUrl}/user`;
  
  // Lê forceConsent do body
  const { forceConsent } = await req.json().catch(() => ({})) || {};
  
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
    include_granted_scopes: "true",
    prompt: forceConsent ? "consent select_account" : "select_account",
    scope: "openid email profile https://www.googleapis.com/auth/drive.metadata.readonly https://www.googleapis.com/auth/drive.file",
    state
  });
  
  const authorizeUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  
  return jsonCors(req, 200, { 
    ok: true, 
    authorizeUrl, 
    redirect_uri: REDIRECT_URI 
  });
}

async function handleDisconnect(req: Request, userId: string) {
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error } = await admin.from("user_drive_tokens").delete().eq("user_id", userId);
    if (error) {
      console.error("Error disconnecting:", error);
      return jsonCors(req, 500, { ok: false, reason: "RESET_FAILED" });
    }
    return jsonCors(req, 200, { ok: true, reset: true });
  } catch (error) {
    console.error("Error disconnecting:", error);
    return jsonCors(req, 500, { 
      ok: false, 
      reason: "RESET_FAILED" 
    });
  }
}

// Main handler
serve(async (req: Request) => {
  // 1) CORS preflight SEMPRE primeiro
  const pf = preflight(req);
  if (pf) return pf;

  // 2) Log básico de diagnóstico
  const origin = req.headers.get("origin");
  console.log("[google-drive-auth]", { method: req.method, origin, url: req.url });

  try {
    const url = new URL(req.url);
    const action = (await captureAction(req, url)) as "authorize" | "callback" | "status" | "disconnect";

    // 3) Callback não é processado aqui (há function dedicada)
    if (action === "callback") {
      return jsonCors(req, 400, { ok: false, reason: "CALLBACK_IS_EXTERNAL" });
    }

    // 4) Validar JWT manualmente para ações protegidas
    const userId = await getUserIdFromJwt(req);
    if (!userId) {
      return jsonCors(req, 401, { ok: false, reason: "INVALID_JWT" });
    }

    if (action === "status") return await handleStatus(req, userId);
    if (action === "authorize") return await handleAuthorize(req, userId, url);
    if (action === "disconnect") return await handleDisconnect(req, userId);

    return jsonCors(req, 400, { ok: false, reason: "UNKNOWN_ACTION" });

  } catch (e: any) {
    console.error("google-drive-auth error:", e?.message || e);
    return jsonCors(req, 500, { ok: false, reason: "INTERNAL_ERROR" });
  }
});