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
  refreshToken: string | null | undefined,
  scope: string,
  expiresAt: string
): Promise<void> {
  // 1) Ler refresh antigo, se necessário
  let finalRefresh = refreshToken ?? null;

  if (!finalRefresh) {
    const { data: existing, error: selErr } = await admin
      .from("user_drive_tokens")
      .select("refresh_token_enc")
      .eq("user_id", userId)
      .maybeSingle();

    if (!selErr && existing?.refresh_token_enc) {
      try {
        // decryptPacked: decifra para string pura
        const oldRefresh = await decryptPacked(existing.refresh_token_enc);
        if (oldRefresh) finalRefresh = oldRefresh;
      } catch {
        // ignora falha de decrypt — segue sem refresh
      }
    }
  }

  // 2) Montar payload sem sobrescrever refresh se não houver
  const payload: Record<string, any> = {
    user_id: userId,
    access_token_enc: await encryptPacked(accessToken),
    scope,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  };

  if (finalRefresh) {
    payload.refresh_token_enc = await encryptPacked(finalRefresh);
  }

  // 3) Upsert (não inclua refresh_token_enc para não apagá-lo)
  const { error } = await admin
    .from("user_drive_tokens")
    .upsert(payload, { onConflict: "user_id", ignoreDuplicates: false });

  if (error) {
    throw new Error(`DB upsert error: ${error.message}`);
  }

  // 4) Se não existe refresh novo nem antigo (primeira conexão falhou):
  //    sinalize para forçar reconexão/consent.
  if (!finalRefresh) {
    console.warn("⚠️ upsertTokens: missing refresh_token (kept empty). User may need to reconnect with consent.");
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
      throw new Error(`Database retrieval error: ${error.message || JSON.stringify(error)}`);
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
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 1) Buscar tokens atuais
  const { data, error } = await admin
    .from("user_drive_tokens")
    .select("access_token_enc, refresh_token_enc, scope, expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) throw new Error("NO_TOKENS");

  const accessToken = data.access_token_enc ? await decryptPacked(data.access_token_enc) : null;
  const refreshToken = data.refresh_token_enc ? await decryptPacked(data.refresh_token_enc) : null;
  const scope = data.scope || "";
  const exp = data.expires_at ? new Date(data.expires_at).getTime() : 0;

  // 2) Se access token ainda válido (skew 60s), use-o
  const SKEW_MS = 60_000;
  if (accessToken && exp - SKEW_MS > Date.now()) {
    return accessToken;
  }

  // 3) Sem refresh token → reconectar
  if (!refreshToken) throw new Error("NO_REFRESH_TOKEN");

  // 4) Refresh token: NÃO mande redirect_uri; mande form-urlencoded correto
  const body = new URLSearchParams({
    client_id: Deno.env.get("GOOGLE_DRIVE_CLIENT_ID")!,
    client_secret: Deno.env.get("GOOGLE_DRIVE_CLIENT_SECRET")!,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  }).toString();

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  const json = await resp.json().catch(() => ({}));

  if (!resp.ok) {
    console.error("REFRESH_ERROR", { status: resp.status, json });
    // padroniza motivo
    const code = (json?.error || resp.status || "UNKNOWN").toString().toUpperCase();
    throw new Error(`OAUTH_REFRESH_FAILED:${code}`);
  }

  const newAccess = json.access_token as string | undefined;
  const expires_in = Number(json.expires_in ?? 3600);
  const newExpiresAt = new Date(Date.now() + Math.max(0, (expires_in - 60)) * 1000).toISOString();

  if (!newAccess) throw new Error("NO_ACCESS_TOKEN_AFTER_REFRESH");

  // 5) Salvar novo access token (preserva refresh antigo)
  await upsertTokens(userId, newAccess, null, scope, newExpiresAt);

  return newAccess;
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
      throw new Error(`Database deletion error: ${error.message || JSON.stringify(error)}`);
    }

    console.log("✅ Tokens deleted successfully");
  } catch (error) {
    console.error("❌ Error deleting tokens:", error);
    throw error;
  }
}