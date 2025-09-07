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

async function decryptPacked(encB64: string): Promise<string> {
  const key = await getKey();
  const buf = b64toU8(encB64);
  const iv = buf.slice(0, 12);
  const ct = buf.slice(12);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(pt);
}

// Main token management functions
export async function upsertTokens(
  userId: string,
  accessToken: string,
  refreshToken: string,
  scope: string,
  expiresAt: string
): Promise<void> {
  console.log(`🔒 Storing encrypted tokens for user: ${userId}`);
  
  try {
    const access_token_enc = await encryptPacked(accessToken);
    const refresh_token_enc = await encryptPacked(refreshToken);

    const { error } = await admin
      .from('user_drive_tokens')
      .upsert({
        user_id: userId,
        access_token_enc,
        refresh_token_enc,
        scope,
        expires_at: expiresAt,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error("❌ Database error storing tokens:", error);
      throw new Error(`Database error: ${error.message}`);
    }

    console.log("✅ Tokens stored successfully");
  } catch (error) {
    console.error("❌ Error in upsertTokens:", error);
    throw error;
  }
}

export async function getTokens(userId: string): Promise<{
  access_token: string;
  refresh_token: string;
  scope: string;
  expires_at: string;
} | null> {
  console.log(`🔍 Retrieving tokens for user: ${userId}`);

  try {
    const { data, error } = await admin
      .from('user_drive_tokens')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error("❌ Database error retrieving tokens:", error);
      throw new Error("DB_ERROR");
    }

    if (!data) {
      console.log("ℹ️ No tokens found for user");
      return null;
    }

    const access_token = await decryptPacked(data.access_token_enc);
    const refresh_token = await decryptPacked(data.refresh_token_enc);

    console.log("✅ Tokens retrieved and decrypted successfully");
    
    return {
      access_token,
      refresh_token,
      scope: data.scope as string,
      expires_at: data.expires_at as string
    };
  } catch (error) {
    console.error("❌ Error in getTokens:", error);
    throw error;
  }
}

export async function refreshAccessToken(userId: string): Promise<string> {
  console.log(`🔄 Refreshing access token for user: ${userId}`);

  try {
    const tokens = await getTokens(userId);
    if (!tokens) {
      throw new Error("No tokens found for user");
    }

    const clientId = Deno.env.get('GOOGLE_DRIVE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_DRIVE_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new Error("Google Drive client credentials not configured");
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
      const errorText = await response.text();
      console.error("❌ OAuth refresh failed:", response.status, errorText);
      throw new Error(`OAuth refresh failed: ${response.status}`);
    }

    const refreshData = await response.json();
    const newExpiresAt = new Date(Date.now() + (refreshData.expires_in * 1000)).toISOString();

    // Update stored tokens
    await upsertTokens(
      userId,
      refreshData.access_token,
      tokens.refresh_token, // Keep existing refresh token unless new one provided
      tokens.scope,
      newExpiresAt
    );

    console.log("✅ Access token refreshed successfully");
    return refreshData.access_token;
  } catch (error) {
    console.error("❌ Error refreshing token:", error);
    throw error;
  }
}

export async function ensureAccessToken(userId: string): Promise<string> {
  console.log(`🔍 Ensuring valid access token for user: ${userId}`);

  try {
    const tokens = await getTokens(userId);
    if (!tokens) {
      throw new Error("NO_ACCESS_TOKEN");
    }

    // Check if token expires within 60 seconds
    const expirationBuffer = 60 * 1000; // 60 seconds in milliseconds
    const expiresAt = new Date(tokens.expires_at).getTime();
    const needsRefresh = expiresAt - Date.now() < expirationBuffer;

    if (needsRefresh) {
      console.log("🔄 Token near expiration, refreshing...");
      return await refreshAccessToken(userId);
    }

    console.log("✅ Current access token is still valid");
    return tokens.access_token;
  } catch (error) {
    console.error("❌ Error ensuring access token:", error);
    throw error;
  }
}

export async function deleteTokens(userId: string): Promise<void> {
  console.log(`🗑️ Deleting tokens for user: ${userId}`);

  try {
    const { error } = await admin
      .from('user_drive_tokens')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error("❌ Database error deleting tokens:", error);
      throw new Error("DB_UPSERT_ERROR");
    }

    console.log("✅ Tokens deleted successfully");
  } catch (error) {
    console.error("❌ Error deleting tokens:", error);
    throw error;
  }
}