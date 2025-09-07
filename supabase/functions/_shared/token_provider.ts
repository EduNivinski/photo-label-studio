import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Crypto utilities for AES-GCM encryption/decryption
const b64ToU8 = (b64: string) => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
const u8ToB64 = (u8: Uint8Array) => btoa(String.fromCharCode(...u8));

let encryptKey: CryptoKey | null = null;
let decryptKey: CryptoKey | null = null;

async function getEncryptKey() {
  if (!encryptKey) {
    const keyRaw = b64ToU8(Deno.env.get("TOKEN_ENC_KEY")!);
    encryptKey = await crypto.subtle.importKey("raw", keyRaw, { name: "AES-GCM" }, false, ["encrypt"]);
  }
  return encryptKey;
}

async function getDecryptKey() {
  if (!decryptKey) {
    const keyRaw = b64ToU8(Deno.env.get("TOKEN_ENC_KEY")!);
    decryptKey = await crypto.subtle.importKey("raw", keyRaw, { name: "AES-GCM" }, false, ["decrypt"]);
  }
  return decryptKey;
}

async function encryptToB64(plain: string) {
  const key = await getEncryptKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain)));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return u8ToB64(out);
}

async function decryptFromB64(b64: string) {
  const key = await getDecryptKey();
  const buf = b64ToU8(b64);
  const iv = buf.slice(0, 12);
  const ct = buf.slice(12);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(pt);
}

// Supabase client
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

export interface TokenData {
  access_token: string;
  refresh_token: string;
  scope: string;
  expires_at: string;
}

export async function getTokens(user_id: string): Promise<TokenData | null> {
  console.log(`🔍 Getting tokens for user: ${user_id}`);
  
  const { data, error } = await supabaseAdmin
    .from("google_drive_tokens")
    .select("access_token_secret_id, refresh_token_secret_id, scopes, expires_at")
    .eq("user_id", user_id)
    .maybeSingle();

  if (error) {
    console.error("DB error:", error);
    throw new Error("DB_ERROR");
  }
  if (!data) {
    console.log("No token record found for user");
    return null;
  }

  console.log("Token metadata found. Secret IDs:", {
    access: data.access_token_secret_id,
    refresh: data.refresh_token_secret_id
  });

  // First, try to get the encrypted tokens directly from database if they're stored there
  // If not, we'll need to use the existing encrypted functions with the secret IDs
  
  try {
    // For now, let's see if the secret IDs are actually the encrypted tokens
    if (typeof data.access_token_secret_id === 'string' && 
        typeof data.refresh_token_secret_id === 'string' &&
        data.access_token_secret_id.length > 50 && 
        data.refresh_token_secret_id.length > 50) {
      
      console.log("Attempting to decrypt tokens stored as secret IDs...");
      
      const access_token = await decryptFromB64(data.access_token_secret_id);
      const refresh_token = await decryptFromB64(data.refresh_token_secret_id);
      
      console.log("Tokens successfully decrypted!");
      
      return {
        access_token,
        refresh_token,
        scope: data.scopes?.join(' ') || '',
        expires_at: data.expires_at
      };
    } else {
      console.error("Secret IDs don't appear to be encrypted tokens:", {
        accessIdType: typeof data.access_token_secret_id,
        accessIdLength: data.access_token_secret_id?.length,
        refreshIdType: typeof data.refresh_token_secret_id,
        refreshIdLength: data.refresh_token_secret_id?.length
      });
      throw new Error("INVALID_SECRET_FORMAT");
    }
  } catch (decryptError) {
    console.error("Decryption failed:", decryptError);
    throw new Error("DECRYPTION_FAILED");
  }
}

export async function upsertTokens(
  user_id: string, 
  access_token: string, 
  refresh_token: string, 
  scope: string, 
  expires_at: string
) {
  // Store tokens securely in Vault
  const accessSecretName = `gd_access_${user_id}`;
  const refreshSecretName = `gd_refresh_${user_id}`;

  // Create/update secrets in Vault
  const { error: accessVaultError } = await supabaseAdmin.rpc('vault.create_secret', {
    secret: access_token,
    name: accessSecretName,
    description: `Google Drive access token for user ${user_id}`
  });

  const { error: refreshVaultError } = await supabaseAdmin.rpc('vault.create_secret', {
    secret: refresh_token,
    name: refreshSecretName,
    description: `Google Drive refresh token for user ${user_id}`
  });

  if (accessVaultError || refreshVaultError) {
    throw new Error("VAULT_UPSERT_ERROR");
  }

  // Update metadata table
  const { error } = await supabaseAdmin
    .from("google_drive_tokens")
    .upsert({ 
      user_id,
      access_token_secret_id: accessSecretName, // Using name as ID for simplicity
      refresh_token_secret_id: refreshSecretName,
      scopes: scope ? scope.split(' ') : [],
      expires_at,
      updated_at: new Date().toISOString() 
    });

  if (error) throw new Error("DB_UPSERT_ERROR");
}

// Refresh token and retry helper
export async function ensureAccessToken(user_id: string): Promise<string> {
  let t = await getTokens(user_id);
  if (!t) throw new Error("NO_ACCESS_TOKEN");

  const secLeft = (new Date(t.expires_at).getTime() - Date.now()) / 1000;
  if (secLeft > 60) return t.access_token;

  console.log("Token expires soon, refreshing...");

  // Refresh token
  const u = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: t.refresh_token,
    client_id: Deno.env.get("GOOGLE_DRIVE_CLIENT_ID")!,
    client_secret: Deno.env.get("GOOGLE_DRIVE_CLIENT_SECRET")!,
  });

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: u.toString(),
  });

  if (!r.ok) {
    console.error("Refresh failed:", r.status, await r.text());
    throw new Error("REFRESH_FAILED");
  }

  const j = await r.json();
  const expires_at = new Date(Date.now() + (j.expires_in - 60) * 1000).toISOString();

  await upsertTokens(user_id, j.access_token, t.refresh_token, j.scope ?? t.scope, expires_at);
  console.log("Token refreshed successfully");
  
  return j.access_token;
}