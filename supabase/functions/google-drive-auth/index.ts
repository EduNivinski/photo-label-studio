import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { requireAuth, httpJson, safeError, getClientIp } from "../_shared/http.ts";
import { checkRateLimit, RATE_LIMITS } from "../_shared/rate-limit.ts";
import { ensureAccessToken } from "../_shared/token_provider_v2.ts";

// CORS helper
const DEFAULT_ALLOWED = [
  "https://photo-label-studio.lovable.app",
  "http://localhost:3000",
  "http://localhost:5173",
];
const ALLOW = new Set(
  (Deno.env.get("CORS_ALLOWED_ORIGINS")?.split(",") ?? DEFAULT_ALLOWED)
    .map(s => s.trim()).filter(Boolean)
);

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin");
  const allowed = origin && ALLOW.has(origin) ? origin : "https://photo-label-studio.lovable.app";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  } as const;
}

function getAdmin() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("ENV_MISSING_SUPABASE_SERVICE_ROLE");
  return createClient(url, key);
}

// Generate cryptographically secure random base64url string
function randBase64URL(len = 32): string {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

// Get user drive settings
async function getUserDriveSettings(userId: string) {
  const admin = getAdmin();
  const { data, error } = await admin
    .from("user_drive_settings")
    .select("drive_folder_id, drive_folder_name, drive_folder_path, scope_granted, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`DB_GET_SETTINGS: ${error.message}`);
  return data || null;
}

// Handle status check
async function handleStatus(userId: string) {
  const traceId = crypto.randomUUID();
  const projectUrl = Deno.env.get("SUPABASE_URL");
  
  console.log("[status][env]", { traceId, projectUrl, user_id: userId });
  
  const settings = await getUserDriveSettings(userId);
  
  // Read sync state for diagnostics
  const admin = getAdmin();
  const { data: syncState } = await admin
    .from("drive_sync_state")
    .select("root_folder_id")
    .eq("user_id", userId)
    .maybeSingle();
  
  try {
    const token = await ensureAccessToken(userId);
    if (!token) throw new Error("NO_ACCESS_TOKEN");
    
    console.log("[status]", {
      traceId,
      user_id: userId,
      dedicatedFolderId: settings?.drive_folder_id ?? null,
      stateRootFolderId: syncState?.root_folder_id ?? null,
    });
    
    return httpJson(200, {
      ok: true,
      connected: true,
      hasConnection: true,
      isExpired: false,
      isConnected: Boolean(settings?.scope_granted),
      dedicatedFolderId: settings?.drive_folder_id ?? null,
      dedicatedFolderName: settings?.drive_folder_name ?? null,
      dedicatedFolderPath: settings?.drive_folder_path ?? (settings?.drive_folder_name ?? null),
      updatedAt: settings?.updated_at ?? null,
      statusVersion: settings?.updated_at ?? null,
      // Diagnostics
      settingsFolderId: settings?.drive_folder_id ?? null,
      stateRootFolderId: syncState?.root_folder_id ?? null,
      traceId,
    });
  } catch (e: any) {
    const reason = (e?.message || "").toUpperCase();
    console.log("[status]", {
      traceId,
      user_id: userId,
      dedicatedFolderId: settings?.drive_folder_id ?? null,
      stateRootFolderId: syncState?.root_folder_id ?? null,
      error: reason,
    });
    
    return httpJson(200, {
      ok: true,
      connected: false,
      hasConnection: false,
      isExpired: true,
      reason: reason || "EXPIRED_OR_INVALID",
      isConnected: false,
      dedicatedFolderId: settings?.drive_folder_id ?? null,
      dedicatedFolderName: settings?.drive_folder_name ?? null,
      dedicatedFolderPath: settings?.drive_folder_path ?? (settings?.drive_folder_name ?? null),
      updatedAt: settings?.updated_at ?? null,
      statusVersion: settings?.updated_at ?? null,
      // Diagnostics
      settingsFolderId: settings?.drive_folder_id ?? null,
      stateRootFolderId: syncState?.root_folder_id ?? null,
      traceId,
    });
  }
}

// Handle authorization flow
async function handleAuthorize(userId: string) {
  // Get OAuth configuration
  const clientId = Deno.env.get("GOOGLE_DRIVE_CLIENT_ID");
  const redirectUri = Deno.env.get("GDRIVE_REDIRECT_URI");

  if (!clientId || !redirectUri) {
    console.error("[google-drive-auth] Missing OAuth config", {
      hasClientId: !!clientId,
      hasRedirectUri: !!redirectUri
    });
    throw new Error("OAUTH_CONFIG_MISSING");
  }

  // Define OAuth scopes
  const scopes = [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/drive.metadata.readonly",
    "https://www.googleapis.com/auth/drive.file"
  ].join(" ");

  // Generate and store state
  const state = randBase64URL(32);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

  const admin = getAdmin();
  const { error: stateErr } = await admin
    .from("oauth_state")
    .insert({
      user_id: userId,
      state,
      provider: "google",
      expires_at: expiresAt
    });

  if (stateErr) {
    console.error("[google-drive-auth] State storage error:", stateErr);
    throw new Error("STATE_STORAGE_FAILED");
  }

  // Build authorization URL
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    scope: scopes,
    state
  });

  const authorizeUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  console.log("[google-drive-auth] Authorization URL generated", {
    userId,
    redirect_uri: redirectUri
  });

  return httpJson(200, { ok: true, authorizeUrl });
}

// Handle disconnect
async function handleDisconnect(userId: string) {
  const admin = getAdmin();
  const { error } = await admin
    .from('user_drive_tokens')
    .delete()
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
  return httpJson(200, { ok: true, message: "Disconnected successfully" });
}

// Zod schema for set_folder
const SetFolderSchema = z.object({
  folderId: z.string().min(5).max(256),
  folderName: z.string().min(1).max(256).optional(),
  folderPath: z.string().min(1).max(1024).optional(),
});

// Handle set_folder action
async function handleSetFolder(userId: string, body: any) {
  const traceId = crypto.randomUUID();
  const projectUrl = Deno.env.get("SUPABASE_URL");
  
  console.log("[set-folder][env]", { traceId, projectUrl, user_id: userId });
  
  try {
    // Validate input with Zod
    const parsed = SetFolderSchema.safeParse(body);
    if (!parsed.success) {
      console.error("[set-folder][validation-failed]", { traceId, errors: parsed.error });
      throw new Error("VALIDATION_FAILED");
    }
    
    const { folderId, folderName, folderPath } = parsed.data;

    // 1) Ensure user has a valid Drive connection
    const admin = getAdmin();
    
    // Check if user has valid tokens
    const { data: tokenData, error: tokenError } = await admin
      .from("user_drive_tokens")
      .select("access_token_enc, expires_at")
      .eq("user_id", userId)
      .maybeSingle();
    
    if (tokenError) throw new Error(`TOKEN_LOOKUP_FAILED: ${tokenError.message}`);
    if (!tokenData) throw new Error("DRIVE_NOT_CONNECTED");
    
    // 2) Get a valid access token (auto-refresh if needed)
    let accessToken: string;
    try {
      accessToken = await ensureAccessToken(userId);
    } catch (e: any) {
      console.error("[set-folder][token-refresh-failed]", { traceId, error: e.message });
      throw new Error("TOKEN_REFRESH_FAILED");
    }

    // 3) Verify the folder exists on Google Drive
    // Use supportsAllDrives=true to support Shared Drives
    const metaUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?` +
      `fields=id,name,mimeType,trashed,parents,driveId,shortcutDetails&supportsAllDrives=true`;
    
    let metaResp = await fetch(metaUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    // Map Google Drive API errors
    if (!metaResp.ok) {
      const googleError = await metaResp.json().catch(() => ({}));
      const googleStatus = metaResp.status;
      
      console.error("[set-folder.lookup]", { 
        traceId, 
        user_id: userId,
        incomingFolderId: folderId,
        googleStatus, 
        googleError 
      });
      
      // 401: Token expired or invalid
      if (googleStatus === 401) {
        return httpJson(401, {
          ok: false,
          persisted: false,
          code: "TOKEN_EXPIRED",
          error: "Access token expired",
          traceId
        });
      }
      
      // 403: Insufficient permissions or scopes
      if (googleStatus === 403) {
        const errorReason = googleError?.error?.message || "";
        const requiredScopes = errorReason.includes("scope") 
          ? ["https://www.googleapis.com/auth/drive.readonly"]
          : [];
        
        return httpJson(403, {
          ok: false,
          persisted: false,
          code: "INSUFFICIENT_SCOPE",
          error: "Insufficient permissions to access folder",
          requiredScopes,
          traceId
        });
      }
      
      // 404: Folder not found
      if (googleStatus === 404) {
        return httpJson(404, {
          ok: false,
          persisted: false,
          code: "FOLDER_NOT_FOUND",
          error: "Folder not found in Google Drive",
          traceId
        });
      }
      
      // 429: Rate limit
      if (googleStatus === 429) {
        const retryAfter = metaResp.headers.get("Retry-After") || "60";
        return httpJson(429, {
          ok: false,
          persisted: false,
          code: "RETRYABLE",
          error: "Rate limit exceeded",
          retryAfter: parseInt(retryAfter),
          traceId
        });
      }
      
      // 503: Service unavailable
      if (googleStatus === 503) {
        return httpJson(503, {
          ok: false,
          persisted: false,
          code: "RETRYABLE",
          error: "Google Drive temporarily unavailable",
          traceId
        });
      }
      
      // Other errors
      return httpJson(500, {
        ok: false,
        persisted: false,
        code: "DRIVE_LOOKUP_ERROR",
        error: "Failed to verify folder with Google Drive",
        googleError,
        traceId
      });
    }

    let meta = await metaResp.json();
    
    // Resolve shortcuts
    let isShortcut = false;
    let resolvedId = meta.id;
    
    if (meta.mimeType === "application/vnd.google-apps.shortcut") {
      isShortcut = true;
      const targetId = meta.shortcutDetails?.targetId;
      
      if (!targetId) {
        console.error("[set-folder][shortcut-no-target]", { traceId, folderId });
        return httpJson(400, {
          ok: false,
          persisted: false,
          code: "INVALID_FOLDER_TYPE",
          error: "Shortcut has no target",
          traceId
        });
      }
      
      console.log("[set-folder.lookup][resolving-shortcut]", { 
        traceId, 
        shortcutId: folderId,
        targetId 
      });
      
      // Fetch the target
      const targetUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(targetId)}?` +
        `fields=id,name,mimeType,trashed,parents,driveId&supportsAllDrives=true`;
      
      const targetResp = await fetch(targetUrl, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      if (!targetResp.ok) {
        console.error("[set-folder][shortcut-target-failed]", { 
          traceId, 
          status: targetResp.status 
        });
        return httpJson(400, {
          ok: false,
          persisted: false,
          code: "INVALID_FOLDER_TYPE",
          error: "Failed to resolve shortcut target",
          traceId
        });
      }
      
      meta = await targetResp.json();
      resolvedId = meta.id;
    }
    
    // Validate folder type
    if (meta.mimeType !== "application/vnd.google-apps.folder") {
      console.error("[set-folder][not-folder]", { 
        traceId, 
        mimeType: meta.mimeType,
        isShortcut 
      });
      return httpJson(400, {
        ok: false,
        persisted: false,
        code: "INVALID_FOLDER_TYPE",
        error: `Not a folder (mimeType: ${meta.mimeType})`,
        traceId
      });
    }
    
    // Check if trashed
    if (meta.trashed === true) {
      console.error("[set-folder][folder-trashed]", { traceId });
      return httpJson(400, {
        ok: false,
        persisted: false,
        code: "FOLDER_TRASHED",
        error: "Folder is in trash",
        traceId
      });
    }
    
    console.log("[set-folder.lookup]", {
      traceId,
      user_id: userId,
      incomingFolderId: folderId,
      googleStatus: 200,
      isShortcut,
      resolvedId,
      mimeType: meta.mimeType,
      driveId: meta.driveId || null
    });

    // 4) Transactional persist with read-back
    // Use resolved folder ID (in case it was a shortcut)
    const finalFolderId = resolvedId;
    const finalFolderName = folderName ?? meta.name ?? "Unknown";
    const finalFolderPath = folderPath ?? finalFolderName;

    // 4.1) SELECT old values
    const { data: oldSettings } = await admin
      .from("user_drive_settings")
      .select("drive_folder_id, drive_folder_name")
      .eq("user_id", userId)
      .maybeSingle();

    const oldFolderId = oldSettings?.drive_folder_id ?? null;
    
    console.log("[set-folder][before-upsert]", { 
      traceId, 
      user_id: userId, 
      incomingFolderId: folderId,
      resolvedFolderId: finalFolderId,
      oldFolderId
    });

    // 4.2) UPSERT
    console.log("[uds-write]", { 
      traceId, 
      user_id: userId, 
      fieldsTouched: ["drive_folder_id","drive_folder_name","drive_folder_path","updated_at"], 
      caller: "google-drive-auth.set_folder" 
    });

    const { error: updateError } = await admin
      .from("user_drive_settings")
      .upsert({
        user_id: userId,
        drive_folder_id: finalFolderId,
        drive_folder_name: finalFolderName,
        drive_folder_path: finalFolderPath,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id'
      });

    if (updateError) {
      console.error("[set-folder][upsert-failed]", { traceId, error: updateError.message });
      return httpJson(500, {
        ok: false,
        persisted: false,
        code: "SET_FOLDER_FAIL",
        error: "Failed to save folder settings",
        details: updateError.message,
        traceId
      });
    }

    // 4.3) RESET drive_sync_state
    const { error: resetSyncError } = await admin
      .from("drive_sync_state")
      .upsert({
        user_id: userId,
        root_folder_id: null,
        pending_folders: [],
        status: 'idle',
        last_error: null,
        start_page_token: null,
        last_full_scan_at: null,
        last_changes_at: null,
        stats: {},
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id'
      });
    
    if (resetSyncError) {
      console.warn("[set-folder][reset-sync-failed]", { traceId, error: resetSyncError.message });
      return httpJson(500, {
        ok: false,
        persisted: false,
        code: "SET_FOLDER_FAIL",
        error: "Failed to reset sync state",
        details: resetSyncError.message,
        traceId
      });
    }

    // 4.4) READ-BACK to confirm persistence
    const { data: savedSettings, error: readbackError } = await admin
      .from("user_drive_settings")
      .select("drive_folder_id, drive_folder_name, drive_folder_path")
      .eq("user_id", userId)
      .maybeSingle();

    if (readbackError || !savedSettings) {
      console.error("[set-folder][readback-failed]", { 
        traceId, 
        error: readbackError?.message 
      });
      return httpJson(500, {
        ok: false,
        persisted: false,
        code: "SET_FOLDER_FAIL",
        error: "Failed to verify saved folder",
        traceId
      });
    }

    const savedFolderId = savedSettings.drive_folder_id;
    const savedFolderName = savedSettings.drive_folder_name;
    const savedFolderPath = savedSettings.drive_folder_path;

    // Verify that saved values match what we tried to save
    if (savedFolderId !== finalFolderId) {
      console.error("[set-folder][save-mismatch]", {
        traceId,
        incomingFolderId: folderId,
        resolvedFolderId: finalFolderId,
        savedFolderId
      });
      return httpJson(500, {
        ok: false,
        persisted: false,
        code: "SAVE_MISMATCH",
        error: "Saved folder ID does not match",
        details: `Expected ${finalFolderId}, got ${savedFolderId}`,
        traceId
      });
    }

    console.log("[set-folder.persist]", { 
      traceId,
      user_id: userId, 
      incomingFolderId: folderId,
      resolvedFolderId: finalFolderId,
      oldFolderId,
      savedFolderId,
      savedFolderName,
      savedFolderPath
    });

    return httpJson(200, { 
      ok: true,
      persisted: true,
      folderId: savedFolderId, 
      dedicatedFolderId: savedFolderId,
      dedicatedFolderName: savedFolderName,
      dedicatedFolderPath: savedFolderPath,
      savedFolderId,
      savedFolderName,
      savedFolderPath,
      message: "Folder saved and verified. Click Sync to start.",
      traceId
    });

  } catch (err: any) {
    console.error("[set-folder][error]", {
      traceId,
      user_id: userId,
      error: err?.message || String(err)
    });
    
    return httpJson(500, {
      ok: false,
      persisted: false,
      code: "SET_FOLDER_FAIL",
      error: err?.message || "Unknown error",
      traceId
    });
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  try {
    if (req.method !== "POST") {
      throw new Error("METHOD_NOT_ALLOWED");
    }

    // Authenticate user
    const { userId } = await requireAuth(req);

    // Rate limiting
    const clientIp = getClientIp(req);
    const canProceed = await checkRateLimit({
      userId,
      ip: clientIp,
      endpoint: "google-drive-auth",
      limit: RATE_LIMITS["google-drive-auth"].limit,
      windowSec: RATE_LIMITS["google-drive-auth"].windowSec,
    });

    if (!canProceed) {
      return httpJson(429, { ok: false, error: "Rate limit exceeded. Please try again later." });
    }

    // Parse action from body
    const body = await req.json().catch(() => ({}));
    const action = body.action || "authorize"; // Default to authorize for backward compatibility

    console.log("[google-drive-auth] Action:", action, "User:", userId);

    // Route to appropriate handler
    if (action === "status") {
      return await handleStatus(userId);
    } else if (action === "authorize") {
      return await handleAuthorize(userId);
    } else if (action === "disconnect") {
      return await handleDisconnect(userId);
    } else if (action === "set_folder" || action === "save-folder") {
      return await handleSetFolder(userId, body);
    } else {
      return httpJson(400, { ok: false, error: "Invalid action" });
    }

  } catch (err: any) {
    console.error("[google-drive-auth] Error:", {
      message: err?.message || "UNKNOWN",
      stack: err?.stack
    });
    
    if (err?.message === "UNAUTHORIZED") {
      return httpJson(401, { ok: false, error: "Unauthorized." });
    }
    
    return safeError(err, { 
      publicMessage: "Unable to process Google Drive request.",
      logContext: "google-drive-auth"
    });
  }
});
