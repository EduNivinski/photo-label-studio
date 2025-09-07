import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Utility functions
const json = (s: number, b: unknown) => new Response(JSON.stringify(b), {
  status: s, 
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type, x-user-id",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
  }
});

const ok = (b: unknown) => json(200, b);
const bad = (r: string, extra: unknown = {}) => json(400, { status: 400, reason: r, ...extra });
const fail = (r: string, extra: unknown = {}) => json(500, { status: 500, reason: r, ...extra });

const parseUserId = async (req: Request) => {
  const url = new URL(req.url);
  const q = url.searchParams.get("user_id");
  const h = req.headers.get("x-user-id") || undefined;
  const body = await req.json().catch(() => ({} as any));
  return (body.user_id || q || h) as string | undefined;
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type, x-user-id",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
      }
    });
  }
  
  try {
    const user_id = await parseUserId(req);
    if (!user_id) return bad("MISSING_USER_ID");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! // server-side ONLY
    );

    // 1) Buscar tokens via RPC SEGURO (nunca retornar tokens ao cliente)
    const { data, error } = await supabase.rpc("get_google_drive_tokens_secure", { p_user_id: user_id });
    if (error) {
      console.error("RPC_ERROR", error);
      return fail("RPC_ERROR");
    }
    const access_token = data?.access_token;
    if (!access_token) return bad("NO_ACCESS_TOKEN");

    // 2) Validar escopos no Google
    const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(access_token)}`);
    const body = await r.json().catch(() => ({}));
    if (!r.ok) {
      const reason = body?.error_description || body?.error || "INVALID_TOKEN";
      return json(400, { status: 400, reason, scopes: null, expires_in: null });
    }

    return ok({ status: 200, scopes: body?.scope ?? null, expires_in: body?.expires_in ?? null });
  } catch (e: any) {
    console.error("diag_scopes INTERNAL_ERROR", e?.message);
    return fail("INTERNAL_ERROR");
  }
});