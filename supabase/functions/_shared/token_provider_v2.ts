import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// AES-GCM encryption helpers
async function generateKey(): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(Deno.env.get("TOKEN_ENC_KEY")!),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode("google_drive_tokens_salt"),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// Concatenated IV+ciphertext format (compatible with current schema)
async function encryptToken(token: string): Promise<string> {
  const key = await generateKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(token);

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );

  // Concatenate IV + ciphertext and encode as base64
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

async function decryptToken(encryptedData: string): Promise<string> {
  const key = await generateKey();
  const combined = new Uint8Array(
    atob(encryptedData).split('').map(char => char.charCodeAt(0))
  );

  // Extract IV (first 12 bytes) and ciphertext (rest)
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

// Main token management functions
export async function upsertTokens(
  userId: string,
  accessToken: string,
  refreshToken: string,
  scope: string[],
  expiresAt: Date
): Promise<void> {
  console.log(`🔒 Storing encrypted tokens for user: ${userId}`);
  
  try {
    const encryptedAccess = await encryptToken(accessToken);
    const encryptedRefresh = await encryptToken(refreshToken);
    const scopeString = scope.join(' '); // Convert array to space-separated string

    const { error } = await supabase
      .schema('private')
      .from('user_drive_tokens')
      .upsert({
        user_id: userId,
        access_token_enc: encryptedAccess,
        refresh_token_enc: encryptedRefresh,
        scope: scopeString,
        expires_at: expiresAt.toISOString(),
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
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope: string[];
} | null> {
  console.log(`🔍 Retrieving tokens for user: ${userId}`);

  try {
    const { data, error } = await supabase
      .schema('private')
      .from('user_drive_tokens')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        console.log("❌ No tokens found for user");
        return null;
      }
      console.error("❌ Database error retrieving tokens:", error);
      throw new Error(`Database error: ${error.message}`);
    }

    const accessToken = await decryptToken(data.access_token_enc);
    const refreshToken = await decryptToken(data.refresh_token_enc);
    const scopeArray = data.scope ? data.scope.split(/\s+/).filter(Boolean) : [];

    console.log("✅ Tokens retrieved and decrypted successfully");
    
    return {
      accessToken,
      refreshToken,
      expiresAt: new Date(data.expires_at),
      scope: scopeArray
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
        refresh_token: tokens.refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ OAuth refresh failed:", response.status, errorText);
      throw new Error(`OAuth refresh failed: ${response.status}`);
    }

    const refreshData = await response.json();
    const newExpiresAt = new Date(Date.now() + (refreshData.expires_in * 1000));

    // Update stored tokens
    await upsertTokens(
      userId,
      refreshData.access_token,
      tokens.refreshToken, // Keep existing refresh token unless new one provided
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

    // Check if token expires within 5 minutes
    const expirationBuffer = 5 * 60 * 1000; // 5 minutes in milliseconds
    const needsRefresh = tokens.expiresAt.getTime() - Date.now() < expirationBuffer;

    if (needsRefresh) {
      console.log("🔄 Token near expiration, refreshing...");
      return await refreshAccessToken(userId);
    }

    console.log("✅ Current access token is still valid");
    return tokens.accessToken;
  } catch (error) {
    console.error("❌ Error ensuring access token:", error);
    throw error;
  }
}

export async function deleteTokens(userId: string): Promise<void> {
  console.log(`🗑️ Deleting tokens for user: ${userId}`);

  try {
    const { error } = await supabase
      .schema('private')
      .from('user_drive_tokens')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error("❌ Database error deleting tokens:", error);
      throw new Error(`Database error: ${error.message}`);
    }

    console.log("✅ Tokens deleted successfully");
  } catch (error) {
    console.error("❌ Error deleting tokens:", error);
    throw error;
  }
}