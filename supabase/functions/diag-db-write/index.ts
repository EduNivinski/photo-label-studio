import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { upsertTokens } from "../_shared/token_provider_v2.ts";

// CORS helper — aceitar sandbox do Lovable + localhost
function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  let allowOrigin = "";

  try {
    const u = new URL(origin);
    const isLovableRoot     = u.origin === "https://lovable.dev";
    const isLovableSandbox  = u.hostname.endsWith(".sandbox.lovable.dev");
    const isLocal3000       = u.origin === "http://localhost:3000";
    const isLocal5173       = u.origin === "http://localhost:5173";

    if (isLovableRoot || isLovableSandbox || isLocal3000 || isLocal5173) {
      allowOrigin = origin; // ecoa exatamente o origin da página
    }
  } catch { /* ignore */ }

  // Ecoa os headers solicitados no preflight (robusto)
  const reqHeaders = req.headers.get("access-control-request-headers");
  const allowHeaders = (reqHeaders && reqHeaders.trim().length > 0)
    ? reqHeaders
    : "authorization, content-type, apikey, x-client-info";

  return {
    "Access-Control-Allow-Origin": allowOrigin || "https://lovable.dev",
    "Access-Control-Allow-Headers": allowHeaders,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Vary": "Origin, Access-Control-Request-Headers",
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
    const { user_id } = await req.json().catch(() => ({}));
    if (!user_id) return json(400, { status: 400, reason: "MISSING_USER_ID" }, req);

    // Test database write with dummy data
    await upsertTokens(
      user_id, 
      "dummy_access_token", 
      "dummy_refresh_token", 
      "dummy_scope", 
      new Date(Date.now() + 3600000).toISOString()
    );

    console.log(`DB write test successful for user: ${user_id}`);
    return json(200, { status: 200, ok: true, message: "Database write test successful" }, req);

  } catch (e: any) {
    console.error("diag-db-write error:", { msg: e?.message, name: e?.name, stack: e?.stack });
    return json(500, { status: 500, reason: "DB_WRITE_FAILED", detail: e?.message }, req);
  }
});