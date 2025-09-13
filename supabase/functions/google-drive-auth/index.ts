import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

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

const json = (status: number, body: unknown, req: Request) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json",
    ...corsHeaders(req)
  }
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  
  try {
    const clientId = Deno.env.get("GOOGLE_DRIVE_CLIENT_ID");
    const redirectUri = Deno.env.get("GOOGLE_REDIRECT_URI");
    
    if (!clientId || !redirectUri) {
      return json(500, { error: "Missing Google OAuth configuration" }, req);
    }

    // Generate OAuth URL for Google Drive access
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

    return json(200, { 
      authUrl: authUrl.toString(),
      status: "ok" 
    }, req);

  } catch (e: any) {
    console.error("google-drive-auth error:", e);
    return json(500, { error: e?.message || "Internal error" }, req);
  }
});