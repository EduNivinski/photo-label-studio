// _shared/cors.ts
const DEFAULT_ALLOWED = [
  "https://photo-label-studio.lovable.app",
  "http://localhost:3000",
  "http://localhost:5173",
  // opcional: seu sandbox
  // "https://<SEU-SANDBOX>.sandbox.lovable.dev",
];

function getAllowedOrigins(): Set<string> {
  const csv = Deno.env.get("CORS_ALLOWED_ORIGINS");
  const list = csv ? csv.split(",") : DEFAULT_ALLOWED;
  return new Set(list.map(s => s.trim()).filter(Boolean));
}

const ALLOW_ORIGINS = getAllowedOrigins();

export function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOW_ORIGINS.has(origin)
    ? origin
    : "https://photo-label-studio.lovable.app";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers":
      "authorization, content-type, apikey, x-client-info, x-supabase-authorization",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

export function preflight(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(req.headers.get("origin")),
    });
  }
  return null;
}

export function jsonCors(req: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(req.headers.get("origin")),
    },
  });
}