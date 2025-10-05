import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { upsertTokens, getUserTokensRow, decryptPacked, ensureAccessToken } from "../_shared/token_provider_v2.ts";
import { requireAuth, httpJson, safeError, getClientIp } from "../_shared/http.ts";
import { checkRateLimit, RATE_LIMITS } from "../_shared/rate-limit.ts";
import { GoogleDriveAuthActionSchema, GoogleDriveSetFolderSchema, GoogleDriveSetPrefsSchema, validateBody } from "../_shared/validation.ts";

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

const json = (req: Request, status: number, body: unknown) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", ...corsHeaders(req) }
});

function getBearer(req: Request): string | null {
  const a = req.headers.get("authorization");
  if (a && /^Bearer\s+/i.test(a)) return a.replace(/^Bearer\s+/i, "");
  return null;
}

// Helper: resolver o caminho completo no Google Drive
async function resolveDrivePath(accessToken: string, startId: string): Promise<{ id: string, name: string }[]> {
  const chain: { id: string, name: string }[] = [];
  let cur = startId;
  const base = "https://www.googleapis.com/drive/v3/files";
  const params = "fields=id,name,parents,mimeType&supportsAllDrives=true&includeItemsFromAllDrives=true";

  for (let i = 0; i < 20; i++) {
    const r = await fetch(`${base}/${encodeURIComponent(cur)}?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const j = await r.json();
    if (!r.ok) throw new Error("PATH_LOOKUP_FAILED");

    chain.push({ id: j.id, name: j.name || "Sem nome" });

    const parents: string[] = Array.isArray(j.parents) ? j.parents : [];
    const parent = parents[0];
    if (!parent || parent === "root") break; // chegou ao root do Meu Drive
    cur = parent;
  }

  chain.reverse(); // do root -> filho
  // Prefixo amigável
  if (!chain.length || chain[0].name !== "Meu Drive") {
    chain.unshift({ id: "root", name: "Meu Drive" });
  }
  return chain;
}

// Helper functions for user_drive_settings
async function upsertUserDriveSettings(userId: string, folderId: string, folderName: string, folderPath: string) {
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const { error } = await admin
    .from("user_drive_settings")
    .upsert({
      user_id: userId,
      drive_folder_id: folderId,
      drive_folder_name: folderName,
      drive_folder_path: folderPath,
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id" });

  if (error) throw new Error(`DB_UPSERT_SETTINGS: ${error.message}`);
}

async function getUserDriveSettings(userId: string) {
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const { data, error } = await admin
    .from("user_drive_settings")
    .select("drive_folder_id, drive_folder_name, drive_folder_path")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`DB_GET_SETTINGS: ${error.message}`);
  return data || null;
}

// Helper functions for extended scope management
async function setAllowExtendedScope(userId: string, allow: boolean) {
  const admin = getAdmin();

  // 1) tenta update
  const { data: existing, error: selErr } = await admin
    .from("user_drive_settings")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (selErr) throw new Error(`SET_EXT_SCOPE_SELECT:${selErr.message}`);

  if (existing) {
    const { error: updErr } = await admin
      .from("user_drive_settings")
      .update({ allow_extended_scope: allow, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (updErr) throw new Error(`SET_EXT_SCOPE_UPDATE:${updErr.message}`);
  } else {
    // 2) insert mínimo — sem exigir pasta
    const { error: insErr } = await admin
      .from("user_drive_settings")
      .insert({ user_id: userId, allow_extended_scope: allow, scope_granted: '', updated_at: new Date().toISOString() });
    if (insErr) throw new Error(`SET_EXT_SCOPE_INSERT:${insErr.message}`);
  }
}

async function getAllowExtendedScope(userId: string) {
  const admin = getAdmin();
  const { data, error } = await admin
    .from("user_drive_settings")
    .select("allow_extended_scope, scope_granted")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`GET_EXT_SCOPE:${error.message}`);
  return { allow: !!data?.allow_extended_scope, granted: data?.scope_granted || "" };
}

async function saveGrantedScope(userId: string, scope: string) {
  const admin = getAdmin();
  const { error } = await admin
    .from("user_drive_settings")
    .update({ scope_granted: scope, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) console.warn("WARN saveGrantedScope:", error.message);
}

// Helper para extrair action do query ou body
async function getAction(req: Request, url: URL): Promise<string> {
  // 1) tenta query string
  const q = url.searchParams.get("action");
  if (q) return q;

  // 2) tenta body JSON (sem quebrar req.json() futuro)
  if (req.method !== "GET") {
    try {
      const ct = req.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const data = await req.json();
        return (data && typeof data.action === "string") ? data.action : "";
      }
    } catch (_) { /* ignore */ }
  }
  return "";
}

async function handleStatus(req: Request, userId: string) {
  const settings = await getUserDriveSettings(userId); // pode ser null
  const { allow, granted } = await getAllowExtendedScope(userId);
  const downloadsEnabled = allow;
  
  try {
    const token = await ensureAccessToken(userId); // lança se inválido
    if (!token) throw new Error("NO_ACCESS_TOKEN");
    return httpJson(200, {
      ok: true,
      connected: true,
      hasConnection: true,
      isExpired: false,
      downloadsEnabled,
      dedicatedFolderId: settings?.drive_folder_id ?? null,
      dedicatedFolderName: settings?.drive_folder_name ?? null,
      dedicatedFolderPath: settings?.drive_folder_path ?? (settings?.drive_folder_name ?? null)
    });
  } catch (e: any) {
    const reason = (e?.message || "").toUpperCase();
    return httpJson(200, {
      ok: true,
      connected: false,
      hasConnection: false,
      isExpired: true,
      downloadsEnabled,
      reason: reason || "EXPIRED_OR_INVALID",
      // 🔎 Ainda assim devolvemos o caminho salvo
      dedicatedFolderId: settings?.drive_folder_id ?? null,
      dedicatedFolderName: settings?.drive_folder_name ?? null,
      dedicatedFolderPath: settings?.drive_folder_path ?? (settings?.drive_folder_name ?? null)
    });
  }
}

// Callback handling removed - now handled by separate function

async function handleAuthorize(req: Request, userId: string, url: URL) {
  const body = await req.json().catch(() => ({}));
  const redirect = body.redirect || url.searchParams.get("redirect") || (new URL("/settings/drive", url.origin).toString());
  const force = !!(body.forceConsent || url.searchParams.get("forceConsent") === "true");
  const state = btoa(JSON.stringify({ userId, r: redirect }));

  const CLIENT_ID = Deno.env.get("GOOGLE_DRIVE_CLIENT_ID");
  const REDIRECT_URI = Deno.env.get("GDRIVE_REDIRECT_URI")!;
  if (!CLIENT_ID) return httpJson(500, { ok: false, error: "Configuration error." });
  if (!REDIRECT_URI) return httpJson(500, { ok: false, error: "Configuration error." });

  const { allow } = await getAllowExtendedScope(userId);

  const scopes = [
    "openid",
    "email", 
    "profile",
    "https://www.googleapis.com/auth/drive.metadata.readonly",
    "https://www.googleapis.com/auth/drive.file",
  ];
  if (allow) scopes.push("https://www.googleapis.com/auth/drive.readonly"); // ✅ opt-in

  const scopeStr = scopes.join(" ");

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: force ? "consent select_account" : "select_account",
    scope: scopeStr,
    state,
  });

  const authorizeUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  console.log("[google-drive-auth] Using redirect_uri:", REDIRECT_URI);
  return httpJson(200, { ok: true, authorizeUrl, redirect_uri: REDIRECT_URI });
}

async function handleSetFolder(req: Request, userId: string, body: any) {
  try {
    const folderId = body?.folderId?.toString?.() || "";
    const folderNameIn = body?.folderName?.toString?.() || "";
    if (!folderId) return httpJson(400, { ok: false, error: "Missing folder ID." });

    const accessToken = await ensureAccessToken(userId);

    // valida se é pasta
    const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?fields=id,name,mimeType,trashed`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const meta = await metaRes.json().catch(() => ({}));
    if (!metaRes.ok) return httpJson(400, { ok: false, error: "Folder not found." });
    if (meta.trashed) return httpJson(400, { ok: false, error: "Folder is trashed." });
    if (meta.mimeType !== "application/vnd.google-apps.folder") {
      return httpJson(400, { ok: false, error: "Not a folder." });
    }

    // resolve breadcrumb atual e persiste caminho
    const chain = await resolveDrivePath(accessToken, folderId);
    const pathStr = chain.map(n => n.name).join(" / ");
    const finalName = folderNameIn || meta.name || chain[chain.length - 1]?.name || "Pasta sem nome";

    await upsertUserDriveSettings(userId, folderId, finalName, pathStr);

    return httpJson(200, {
      ok: true,
      dedicatedFolderId: folderId,
      dedicatedFolderName: finalName,
      dedicatedFolderPath: pathStr
    });
  } catch (e: any) {
    return safeError(e, { publicMessage: "Unable to set folder.", logContext: "handleSetFolder" });
  }
}

async function getUserIdFromJwt(req: Request): Promise<string | null> {
  try {
    const { userId } = await requireAuth(req);
    return userId;
  } catch {
    return null;
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { 
      status: 204, 
      headers: {
        "Access-Control-Allow-Origin": "https://photo-label-studio.lovable.app",
        "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      }
    });
  }

  const url = new URL(req.url);

  // ✅ Ler body JSON UMA única vez (se houver)
  let body: any = null;
  if (req.method !== "GET") {
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      try { body = await req.json(); } catch (_) { body = null; }
    }
  }

  // ✅ Extrair action da query OU do body lido
  const rawAction = url.searchParams.get("action") || body?.action || "";
  console.log("[google-drive-auth] action:", rawAction);

  try {
    // Validate action
    const action = validateBody(GoogleDriveAuthActionSchema, rawAction);
    
    // Require JWT for all actions
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

    if (action === "status") return await handleStatus(req, userId);
    if (action === "authorize") return await handleAuthorize(req, userId, url);
    
    // ✅ Passar o body JÁ LIDO ao set_folder
    if (action === "set_folder") {
      const { folderId, folderName } = validateBody(GoogleDriveSetFolderSchema, body);
      return await handleSetFolder(req, userId, { folderId, folderName });
    }
    
    if (action === "set_prefs") {
      const { allowExtendedScope } = validateBody(GoogleDriveSetPrefsSchema, body);
      try {
        await setAllowExtendedScope(userId, allowExtendedScope);
        return httpJson(200, { ok: true, allowExtendedScope });
      } catch (e: any) {
        console.error("set_prefs error:", e?.message || e);
        return safeError(e, { publicMessage: "Unable to update preferences.", logContext: "set_prefs" });
      }
    }
    
    if (action === "setFolder") {
      const folderId = body?.folderId?.toString?.() || "";
      const folderName = body?.folderName?.toString?.() || "";
      if (!folderId) return httpJson(400, { ok: false, error: "Missing folder ID." });

      const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { error: eUpd } = await admin
        .from("user_drive_tokens")
        .update({
          dedicated_folder_id: folderId,
          dedicated_folder_name: folderName ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (eUpd) return safeError(eUpd, { publicMessage: "Unable to set folder.", logContext: "setFolder" });
      return httpJson(200, { ok: true, dedicatedFolderId: folderId, dedicatedFolderName: folderName ?? null });
    }
    
    if (action === "disconnect") {
      try {
        const admin = getAdmin();
        const { error } = await admin
          .from('user_drive_tokens')
          .delete()
          .eq('user_id', userId);

        if (error) throw new Error(error.message);
        return httpJson(200, { ok: true, message: "Disconnected successfully" });
      } catch (e: any) {
        return safeError(e, { publicMessage: "Unable to disconnect.", logContext: "disconnect" });
      }
    }

    return httpJson(400, { ok: false, error: "Invalid action." });
  } catch (e: any) {
    if (e?.message === "UNAUTHORIZED") {
      return httpJson(401, { ok: false, error: "Unauthorized." });
    }
    if (e?.message === "VALIDATION_FAILED") {
      return httpJson(400, { ok: false, error: "Invalid request data." });
    }
    return safeError(e, { publicMessage: "Unable to process request.", logContext: "google-drive-auth" });
  }
});