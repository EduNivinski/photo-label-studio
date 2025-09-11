import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { preflight, jsonCors } from "../_shared/cors.ts";

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
      claims,                       // iss/aud/sub/exp (sem conteúdo sensível)
      user_id_from_body: body?.user_id ?? null,
      note: "verify_jwt temporarily disabled in config for diagnostics",
    });
  } catch (e) {
    return jsonCors(req, 500, { ok: false, error: "INTERNAL", message: e?.message });
  }
});