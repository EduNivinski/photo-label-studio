const ALLOW_ORIGINS = new Set<string>([
  "https://photo-label-studio.lovable.app",        // PROD
  "https://a4888df3-b048-425b-8000-021ee0970cd7.sandbox.lovable.dev", // Sandbox
  "https://lovable.dev",                            // Builder
  "http://localhost:3000",
  "http://localhost:5173",
]);

export function corsHeaders(origin: string | null) {
  const allow = origin && ALLOW_ORIGINS.has(origin) ? origin : "https://photo-label-studio.lovable.app";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    // IMPORTANTE: incluir 'apikey' e 'x-client-info'
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    "Vary": "Origin",
  };
}

export function cors(origin: string | null) {
  const allowed = origin && ALLOW_ORIGINS.has(origin) ? origin : "https://photo-label-studio.lovable.app";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, x-supabase-authorization",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Vary": "Origin",
  };
}

export function preflight(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
  }
  return null;
}

export const json = (status: number, body: unknown, origin?: string | null) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors(origin) },
  });

export function jsonResponse(res: unknown, status = 200, req?: Request) {
  return new Response(JSON.stringify(res), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...(req ? corsHeaders(req.headers.get("origin")) : {}),
    },
  });
}