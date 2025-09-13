import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// Local CORS helpers (no shared imports allowed in Edge Functions)
const DEFAULT_ALLOWED = [
  "https://photo-label-studio.lovable.app",
  "http://localhost:3000",
  "http://localhost:5173",
];
const ALLOW = new Set(
  (Deno.env.get("CORS_ALLOWED_ORIGINS")?.split(",") ?? DEFAULT_ALLOWED)
    .map((s) => s.trim())
    .filter(Boolean)
);
function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOW.has(origin)
    ? origin
    : "https://photo-label-studio.lovable.app";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, x-supabase-authorization",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}
function preflight(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
  }
  return null;
}
function jsonCors(req: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(req.headers.get("origin")) },
  });
}

function decodeJwtClaims(authHeader: string | null) {
  try {
    if (!authHeader) return null;
    const token = authHeader.split(" ")[1];
    const [, payload] = token.split(".");
    const decoded = JSON.parse(atob(payload));
    // Retornar só campos seguros
    return { iss: decoded.iss, aud: decoded.aud, sub: decoded.sub, exp: decoded.exp };
  } catch {
    return null;
  }
}

serve(async (req) => {
  console.log("diag-scopes called");

  const pf = preflight(req);
  if (pf) return pf;

  const auth = req.headers.get("authorization");
  const claims = decodeJwtClaims(auth);

  try {
    const body = await req.json().catch(() => ({}));
    return jsonCors(req, 200, {
      ok: true,
      receivedAuth: !!auth,
      hasBearer: !!auth && auth.startsWith("Bearer "),
      claims, // iss/aud/sub/exp (sem conteúdo sensível)
      user_id_from_body: body?.user_id ?? null,
      note: "verify_jwt temporarily disabled in config for diagnostics",
    });
  } catch (e) {
    return jsonCors(req, 500, { ok: false, error: "INTERNAL", message: (e as any)?.message });
  }
});