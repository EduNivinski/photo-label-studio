import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS helper
function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  let allowOrigin = "";
  try {
    const u = new URL(origin);
    const isLovableRoot = u.origin === "https://lovable.dev";
    const isLovableSandbox = u.hostname.endsWith(".sandbox.lovable.dev");
    const isLocal3000 = u.origin === "http://localhost:3000";
    const isLocal5173 = u.origin === "http://localhost:5173";
    if (isLovableRoot || isLovableSandbox || isLocal3000 || isLocal5173) allowOrigin = origin;
  } catch { /* ignore */ }
  return {
    "Access-Control-Allow-Origin": allowOrigin || "https://lovable.dev",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Vary": "Origin",
  } as const;
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

async function handleAuthorize(req: Request, userId: string, url: URL) {
  const body = await req.json().catch(() => ({}));
  const redirect = body.redirect || url.searchParams.get("redirect") || (new URL("/settings/drive", url.origin).toString());
  const force = !!(body.forceConsent || url.searchParams.get("forceConsent") === "true");
  const state = btoa(JSON.stringify({ userId, r: redirect }));

  const CLIENT_ID = Deno.env.get("GOOGLE_DRIVE_CLIENT_ID");
  const REDIRECT_URI = Deno.env.get("GOOGLE_REDIRECT_URI");
  if (!CLIENT_ID || !REDIRECT_URI) return json(req, 500, { ok:false, error: "Missing Google OAuth configuration" });

  const SCOPE = [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/drive.readonly",
  ].join(" ");

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: force ? "consent select_account" : "select_account",
    scope: SCOPE,
    state,
  });

  const authorizeUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  return json(req, 200, { ok: true, authorizeUrl, redirect_uri: REDIRECT_URI });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  try {
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const action = body.action || url.searchParams.get("action");

    // Authorize flow (manual JWT validation because verify_jwt=false)
    if (action === "authorize") {
      const token = getBearer(req);
      if (!token) return json(req, 401, { ok:false, error: "Missing authorization token" });
      const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: { user }, error } = await supa.auth.getUser(token);
      if (error || !user) return json(req, 401, { ok:false, error: "Invalid token" });
      return await handleAuthorize(req, user.id, url);
    }

    // Fallback: return basic info for health check
    return json(req, 200, { ok:true, message: "google-drive-auth ready" });
  } catch (e: any) {
    console.error("google-drive-auth error:", e?.message);
    return json(req, 500, { ok:false, error: e?.message || "Internal error" });
  }
});