import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// Updated CORS helper
const ALLOW_ORIGINS = new Set([
  "https://photo-label-studio.lovable.app",
  "https://a4888df3-b048-425b-8000-021ee0970cd7.sandbox.lovable.dev",
  "http://localhost:3000",
  "http://localhost:5173",
]);

function cors(origin: string | null) {
  const allowed = origin && ALLOW_ORIGINS.has(origin) ? origin : "https://photo-label-studio.lovable.app";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, x-supabase-authorization",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Vary": "Origin",
  };
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

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors(req.headers.get("origin")) });
  }

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", ...cors(req.headers.get("origin")) },
    });

  const auth = req.headers.get("authorization");
  const claims = decodeJwtClaims(auth);

  try {
    const body = await req.json().catch(() => ({}));
    return json(200, {
      ok: true,
      receivedAuth: !!auth,
      hasBearer: !!auth && auth.startsWith("Bearer "),
      claims,                       // iss/aud/sub/exp (sem conteúdo sensível)
      user_id_from_body: body?.user_id ?? null,
      note: "verify_jwt temporarily disabled in config for diagnostics",
    });
  } catch (e) {
    return json(500, { ok: false, error: "INTERNAL", message: e?.message });
  }
});