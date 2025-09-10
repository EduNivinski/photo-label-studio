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
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  const json = (s: number, b: unknown) => new Response(JSON.stringify(b), {
    status: s,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(req)
    }
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