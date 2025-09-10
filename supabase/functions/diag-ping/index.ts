import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// CORS helper - updated for new domain
const ALLOW_ORIGINS = new Set([
  "https://photo-label-studio.lovable.app",                    // novo domínio publicado
  "https://a4888df3-b048-425b-8000-021ee0970cd7.sandbox.lovable.dev", // sandbox
  "https://lovable.dev",                                       // editor (se necessário)
  "http://localhost:3000",
  "http://localhost:5173",
]);

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin");
  const allowed = origin && ALLOW_ORIGINS.has(origin) ? origin : "";
  
  return {
    "Access-Control-Allow-Origin": allowed || "https://photo-label-studio.lovable.app",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Vary": "Origin",
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