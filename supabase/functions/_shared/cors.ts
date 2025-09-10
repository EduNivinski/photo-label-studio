const ALLOW_ORIGINS = new Set([
  "https://photo-label-studio.lovable.app",
  "https://a4888df3-b048-425b-8000-021ee0970cd7.sandbox.lovable.dev",
  "http://localhost:3000",
  "http://localhost:5173",
]);

export function cors(origin: string | null) {
  const allowed = origin && ALLOW_ORIGINS.has(origin) ? origin : "https://photo-label-studio.lovable.app";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, x-supabase-authorization",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Vary": "Origin",
  };
}

export const json = (status: number, body: unknown, origin?: string | null) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors(origin) },
  });