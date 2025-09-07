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
  const { data, error } = await supabaseAdmin
    .from("private.user_drive_tokens")
    .select("*")
    .eq("user_id", user_id)
    .maybeSingle();

  if (error) throw new Error("DB_ERROR");
  if (!data) return null;

  return {
    access_token: await decryptFromB64(data.access_token_enc),
    refresh_token: await decryptFromB64(data.refresh_token_enc),
    scope: data.scope,
    expires_at: data.expires_at
  };
}

export async function upsertTokens(
  user_id: string, 
  access_token: string, 
  refresh_token: string, 
  scope: string, 
  expires_at: string
) {
  const access_token_enc = await encryptToB64(access_token);
  const refresh_token_enc = await encryptToB64(refresh_token);

  const { error } = await supabaseAdmin
    .from("private.user_drive_tokens")
    .upsert({ 
      user_id, 
      access_token_enc, 
      refresh_token_enc, 
      scope, 
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