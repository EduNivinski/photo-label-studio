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

    if (isLovableRoot || isLovableSandbox || isLocal3000 || isLocal5173) {
      allowOrigin = origin;
    }
  } catch { /* ignore */ }

  return {
    "Access-Control-Allow-Origin": allowOrigin || "https://lovable.dev",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Vary": "Origin",
  };
}

const json = (req: Request, status: number, body: unknown) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json",
    ...corsHeaders(req)
  }
});

function getBearer(req: Request): string | null {
  const a = req.headers.get("authorization");
  if (a && /^Bearer\s+/i.test(a)) return a.replace(/^Bearer\s+/i, "");
  return null;
}

async function handleAuthorize(req: Request, userId: string, url: URL) {
  const body = await req.json().catch(() => ({}));
  const redirect = body.redirect || url.searchParams.get("redirect") || "https://tcupxcxyylxfgsbhfdhw.supabase.co/settings/drive";
  
  const force = !!(body.forceConsent || url.searchParams.get("forceConsent") === "true");
  
  const state = btoa(JSON.stringify({ userId, r: redirect }));
  
  const clientId = Deno.env.get("GOOGLE_DRIVE_CLIENT_ID");
  const redirectUri = Deno.env.get("GOOGLE_REDIRECT_URI");
  const scopes = [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/drive.readonly"
  ].join(" ");

  const params = new URLSearchParams({
    client_id: clientId!,
    redirect_uri: redirectUri!,
    response_type: "code",
    access_type: "offline",
    include_granted_scopes: "true",
    // 👇 mudar prompt quando forceConsent for true
    prompt: force ? "consent select_account" : "select_account",
    scope: scopes,
    state,
  });

  const authorizeUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  return json(req, 200, { ok: true, authorizeUrl, redirect_uri: redirectUri });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  
  try {
    const clientId = Deno.env.get("GOOGLE_DRIVE_CLIENT_ID");
    const redirectUri = Deno.env.get("GOOGLE_REDIRECT_URI");
    
    if (!clientId || !redirectUri) {
      return json(req, 500, { error: "Missing Google OAuth configuration" });
    }

    // Check if this is an authorize request
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const action = body.action || url.searchParams.get("action");
    
    if (action === "authorize") {
      // Get userId from JWT
      const token = getBearer(req);
      if (!token) return json(req, 401, { error: "Missing authorization token" });
      
      const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: { user }, error } = await admin.auth.getUser(token);
      if (error || !user) return json(req, 401, { error: "Invalid token" });
      
      return await handleAuthorize(req, user.id, url);
    }

    // Legacy behavior: Generate OAuth URL for Google Drive access
    const scopes = [
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/drive.readonly"
    ].join(" ");

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");

    return json(req, 200, { 
      authUrl: authUrl.toString(),
      status: "ok" 
    });

  } catch (e: any) {
    console.error("google-drive-auth error:", e);
    return json(req, 500, { error: e?.message || "Internal error" });
  }
});