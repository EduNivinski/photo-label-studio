import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

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

const json = (status: number, body: unknown, req: Request) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(req)
    },
  });

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  
  try {
    // Verificar envs essenciais sem expor valores
    const hasUrl = !!Deno.env.get("SUPABASE_URL");
    const hasAnon = !!Deno.env.get("SUPABASE_ANON_KEY");
    const hasServiceRole = !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    return json(200, {
      ok: true,
      function: "diag_ping",
      env: { 
        SUPABASE_URL: hasUrl, 
        SUPABASE_ANON_KEY: hasAnon,
        SUPABASE_SERVICE_ROLE_KEY: hasServiceRole
      },
      now: new Date().toISOString(),
    }, req);
  } catch (e) {
    console.error("diag_ping error", { msg: e?.message, name: e?.name });
    return json(500, { ok: false, error: "INTERNAL_ERROR" }, req);
  }
});