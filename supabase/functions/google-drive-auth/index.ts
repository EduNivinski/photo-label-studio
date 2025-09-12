import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { preflight, jsonCors } from "../_shared/cors.ts";
import { upsertTokens } from "../_shared/token_provider_v2.ts";

function admin() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

async function audit(phase: string, userId: string | null, payload: Record<string, unknown> = {}) {
  try {
    await admin().from("drive_oauth_audit").insert({
      user_id: userId ?? "00000000-0000-0000-0000-000000000000",
      phase,
      has_access_token: !!payload.has_access_token,
      has_refresh_token: !!payload.has_refresh_token,
      details: payload.details ?? null,
    });
  } catch { /* no-op */ }
}

const okHtml = `<!doctype html><meta charset="utf-8"><body>
<script>
  try { window.opener && window.opener.postMessage({ source:"gdrive-oauth", ok:true }, "*"); } catch(e){}
  try { window.close(); } catch(e){}
  setTimeout(()=>location.replace("/user"), 400);
</script>
<p>Google Drive conectado. Pode fechar esta janela.</p>
</body>`;

const errHtml = (msg: string) => {
  const safe = msg.replace(/[<>&]/g, s => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[s]!));
  return `<!doctype html><meta charset="utf-8"><body>
<script>
  try { window.opener && window.opener.postMessage({ source:"gdrive-oauth", ok:false, error:${JSON.stringify(safe)} }, "*"); } catch(e){}
  try { window.close(); } catch(e){}
  setTimeout(()=>location.replace("/user"), 800);
</script>
<pre style="white-space:pre-wrap">${safe}</pre>
</body>`;
};

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
  const result = await ensureAccessToken(userId);
  if (result.ok) {
    return jsonCors(req, 200, { ok: true, connected: true });
  } else {
    return jsonCors(req, 200, { ok: true, connected: false, reason: result.reason });
  }
}

async function handleAuthorize(req: Request, userId: string, url: URL) {
  // Dentro da action "authorize"
  const projectUrl = Deno.env.get("SUPABASE_URL")!.replace(/\/$/, "");
  const REDIRECT_URI = `${projectUrl}/functions/v1/google-drive-auth/callback`;
  const clientId = Deno.env.get("GOOGLE_DRIVE_CLIENT_ID")!;
  
  // Lê forceConsent do body
  const body = await req.json().catch(() => ({}));
  
  const state = btoa(
    JSON.stringify({ userId, ts: Date.now(), nonce: crypto.randomUUID() })
  );

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: body?.forceConsent ? "consent select_account" : "select_account",
    scope: "openid email profile https://www.googleapis.com/auth/drive.metadata.readonly https://www.googleapis.com/auth/drive.file",
    state,
  });
  const authorizeUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  return jsonCors(req, 200, {
    ok: true,
    authorizeUrl,
    redirect_uri: REDIRECT_URI,
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
  // 0) preflight CORS
  const pf = preflight(req);
  if (pf) return pf;

  const url = new URL(req.url);

  // 1) 👇 Callback inline: GET em /functions/v1/google-drive-auth/callback
  if (req.method === "GET" && url.pathname.endsWith("/google-drive-auth/callback")) {
    try {
      await audit("cb_boot", null, { details: { path: url.pathname }});

      const code = url.searchParams.get("code");
      const stateRaw = url.searchParams.get("state");
      const err = url.searchParams.get("error");
      if (err) { await audit("exchange_fail", null, { details: { error: err } }); 
        return new Response(errHtml(`Google error: ${err}`), { status: 400, headers: { "Content-Type": "text/html" }});
      }
      if (!code || !stateRaw) { await audit("exchange_fail", null, { details: { reason:"MISSING_CODE_OR_STATE" }});
        return new Response(errHtml("MISSING_CODE_OR_STATE"), { status: 400, headers: { "Content-Type": "text/html" }});
      }

      let state: any = {};
      try { state = JSON.parse(atob(stateRaw)); } catch { /* ignore */ }
      const userId = state?.userId || null;
      if (!userId) { await audit("exchange_fail", null, { details: { reason:"MISSING_USER_ID" }}); 
        return new Response(errHtml("MISSING_USER_ID"), { status: 400, headers: { "Content-Type": "text/html" }});
      }

      const projectUrl = Deno.env.get("SUPABASE_URL")!.replace(/\/$/, "");
      const REDIRECT_URI = `${projectUrl}/functions/v1/google-drive-auth/callback`;

      await audit("exchange_start", userId, { details: { redirect_uri: REDIRECT_URI }});

      const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: Deno.env.get("GOOGLE_DRIVE_CLIENT_ID")!,
          client_secret: Deno.env.get("GOOGLE_DRIVE_CLIENT_SECRET")!,
          redirect_uri: REDIRECT_URI,
          grant_type: "authorization_code",
        }).toString(),
      });

      const tokenJson = await tokenResp.json().catch(()=> ({}));
      if (!tokenResp.ok) {
        await audit("exchange_fail", userId, { details: tokenJson });
        return new Response(errHtml(`CODE_EXCHANGE_FAILED: ${JSON.stringify(tokenJson)}`), {
          status: 400, headers: { "Content-Type": "text/html" }
        });
      }

      const access_token  = tokenJson.access_token as string | undefined;
      const refresh_token = tokenJson.refresh_token as string | undefined | null;
      const scopeStr      = (tokenJson.scope as string | undefined) ?? "";
      const expires_in    = Number(tokenJson.expires_in ?? 3600);
      const expires_at    = new Date(Date.now() + Math.max(60, expires_in - 60) * 1000).toISOString();

      await audit("exchange_ok", userId, {
        has_access_token: !!access_token,
        has_refresh_token: !!refresh_token,
        details: { scope: scopeStr, expires_in }
      });

      if (!access_token) {
        await audit("upsert_fail", userId, { details: { reason:"MISSING_ACCESS_TOKEN" }});
        return new Response(errHtml("MISSING_ACCESS_TOKEN"), { status: 400, headers: { "Content-Type": "text/html" }});
      }

      try {
        await upsertTokens(userId, access_token, refresh_token ?? null, scopeStr, expires_at);
        await audit("upsert_ok", userId, { has_access_token:true, has_refresh_token: !!refresh_token });
      } catch (e) {
        await audit("upsert_fail", userId, { details: { error: String(e) }});
        return new Response(errHtml("UPSERT_FAILED"), { status: 500, headers: { "Content-Type": "text/html" }});
      }

      return new Response(okHtml, { status: 200, headers: { "Content-Type": "text/html" }});
    } catch (e:any) {
      await audit("cb_error", null, { details: { error: String(e) }});
      return new Response(errHtml("UNKNOWN_ERROR"), { status: 500, headers: { "Content-Type": "text/html" }});
    }
  }

  // 2) 🔒 Daqui pra baixo segue o fluxo NORMAL (authorize/status/disconnect)
  const origin = req.headers.get("origin");
  console.log("[google-drive-auth]", { method: req.method, origin, url: req.url });

  try {
    const action = (await captureAction(req, url)) as "authorize" | "callback" | "status" | "disconnect";

    // 3) Callback não é processado aqui (agora é inline)
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