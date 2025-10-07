import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Optimized AES-GCM encryption with packed IV+ciphertext format
const b64toU8 = (b64: string) => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
const u8toB64 = (u8: Uint8Array) => btoa(String.fromCharCode(...u8));

let _key: CryptoKey | null = null;

async function getKey(): Promise<CryptoKey> {
  if (!_key) {
    const keyRaw = b64toU8(Deno.env.get("TOKEN_ENC_KEY")!);
    _key = await crypto.subtle.importKey("raw", keyRaw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  }
  return _key;
}

async function encryptPacked(plain: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain)));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return u8toB64(out);
}

export async function decryptPacked(encB64: string): Promise<string> {
  const key = await getKey();
  const buf = b64toU8(encB64);
  const iv = buf.slice(0, 12);
  const ct = buf.slice(12);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(pt);
}

// Main token management functions
export async function getUserTokensRow(userId: string): Promise<{
  access_token_enc: string;
  refresh_token_enc: string;
  scope: string;
  expires_at: string;
} | null> {
  const { data } = await admin
    .from("user_drive_tokens")
    .select("access_token_enc, refresh_token_enc, scope, expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

export async function upsertTokens(
  userId: string,
  accessToken: string,
  refreshToken: string | null | undefined,
  scope: string,
  expiresAt: string
): Promise<void> {
  // Get existing tokens to preserve refresh_token if not provided
  const existing = await getUserTokensRow(userId);
  const oldRefresh = existing ? await decryptPacked(existing.refresh_token_enc).catch(() => null) : null;
  const finalRefresh = refreshToken && refreshToken.trim() ? refreshToken : oldRefresh;

  // Never save null refresh_token
  if (!finalRefresh) {
    throw new Error("No refresh token available");
  }

  const access_token_enc = await encryptPacked(accessToken);
  const refresh_token_enc = await encryptPacked(finalRefresh);

  await admin.from("user_drive_tokens").upsert({
    user_id: userId,
    access_token_enc,
    refresh_token_enc,
    scope,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
}

export async function getTokens(userId: string): Promise<{
  access_token: string;
  refresh_token: string;
  scope: string;
  expires_at: string;
} | null> {
  try {
    const { data, error } = await admin
      .from('user_drive_tokens')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw new Error(`Database retrieval error`);
    }

    if (!data) {
      return null;
    }

    const access_token = await decryptPacked(data.access_token_enc);
    const refresh_token = await decryptPacked(data.refresh_token_enc);
    
    return {
      access_token,
      refresh_token,
      scope: data.scope as string,
      expires_at: data.expires_at as string
    };
  } catch (error) {
    console.error("Token retrieval failed");
    throw error;
  }
}

export async function refreshAccessToken(userId: string): Promise<string> {
  try {
    const tokens = await getTokens(userId);
    if (!tokens) {
      throw new Error("No tokens found");
    }

    const clientId = Deno.env.get('GOOGLE_DRIVE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_DRIVE_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new Error("Client credentials not configured");
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tokens.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      throw new Error(`OAuth refresh failed`);
    }

    const refreshData = await response.json();
    const newExpiresAt = new Date(Date.now() + (refreshData.expires_in * 1000)).toISOString();

    await upsertTokens(
      userId,
      refreshData.access_token,
      tokens.refresh_token,
      tokens.scope,
      newExpiresAt
    );

    return refreshData.access_token;
  } catch (error) {
    console.error("Token refresh failed");
    throw error;
  }
}

export async function ensureAccessToken(userId: string): Promise<string> {
  // Always SELECT by user_id (unique key), no ordering by updated_at
  const { data: row } = await admin
    .from("user_drive_tokens")
    .select("access_token_enc, refresh_token_enc, expires_at, scope")
    .eq("user_id", userId)
    .maybeSingle();

  if (!row) throw new Error("NO_TOKENS");

  // Convert expires_at to number and check if still valid
  const ttl = new Date(row.expires_at).getTime() - Date.now();
  if (ttl > 60_000 && row.access_token_enc) {
    return await decryptPacked(row.access_token_enc);
  }

  // Need to refresh
  const finalRefreshToken = row.refresh_token_enc
    ? await decryptPacked(row.refresh_token_enc).catch(() => "")
    : "";
  if (!finalRefreshToken) throw new Error("NO_REFRESH_TOKEN");

  // Refresh request
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: Deno.env.get("GOOGLE_DRIVE_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_DRIVE_CLIENT_SECRET")!,
      refresh_token: finalRefreshToken,
    }),
  });

  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = String(j.error || j.error_description || "invalid_grant").toUpperCase();
    throw new Error(msg.includes("GRANT") || msg.includes("UNAUTHORIZED") ? "NEEDS_RECONSENT" : "REFRESH_FAILED");
  }

  const newAccess = j.access_token as string;
  const newExp = Date.now() + Math.max(0, (j.expires_in ?? 3600) - 60) * 1000;
  const scopeFromRow = row.scope || "";
  
  // Update tokens (refresh stays the same unless Google sends a new one)
  await upsertTokens(userId, newAccess, finalRefreshToken, scopeFromRow, new Date(newExp).toISOString());
  return newAccess;
}

export async function getExistingTokenRow(userId: string): Promise<{
  refresh_token_enc: string;
} | null> {
  const { data } = await admin
    .from("user_drive_tokens")
    .select("refresh_token_enc")
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

export async function deleteTokens(userId: string): Promise<void> {
  try {
    const { error } = await admin
      .from('user_drive_tokens')
      .delete()
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Token deletion failed`);
    }
  } catch (error) {
    console.error("Token deletion failed");
    throw error;
  }
}