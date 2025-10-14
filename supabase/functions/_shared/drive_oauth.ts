import { upsertTokens, getUserTokensRow, decryptPacked } from "./token_provider_v2.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface ExchangeCodeParams {
  code: string;
  state: string;
}

export async function exchangeCodeAndUpsert({ code, state }: ExchangeCodeParams): Promise<void> {
  if (!code || !state) {
    throw new Error("Missing code or state parameter");
  }

  // Parse state to get userId
  let userId: string;
  try {
    const stateData = JSON.parse(atob(state));
    userId = stateData.userId;
    if (!userId) throw new Error("Missing userId in state");
  } catch (e) {
    throw new Error("Invalid state parameter");
  }

  // Get OAuth credentials
  const CLIENT_ID = Deno.env.get("GOOGLE_DRIVE_CLIENT_ID");
  const CLIENT_SECRET = Deno.env.get("GOOGLE_DRIVE_CLIENT_SECRET");
  const REDIRECT_URI = Deno.env.get("GDRIVE_REDIRECT_URI")!;

  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("Missing Google OAuth credentials");
  }

  // Exchange code for tokens
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_URI,
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
    throw new Error("No refresh token available - reconnection required");
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

  // Save granted scope to user_drive_settings
  await saveGrantedScope(userId, (scope as string) || "");
}

async function saveGrantedScope(userId: string, scope: string) {
  const traceId = crypto.randomUUID();
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  
  console.log("[uds-write]", { 
    traceId, 
    user_id: userId, 
    fieldsTouched: ["scope_granted","updated_at"], 
    caller: "_shared/drive_oauth.saveGrantedScope" 
  });
  
  const { error } = await admin
    .from("user_drive_settings")
    .update({
      scope_granted: scope,
      updated_at: new Date().toISOString()
    })
    .eq("user_id", userId);
  if (error) console.warn("WARN saveGrantedScope:", { traceId, error: error.message });
}