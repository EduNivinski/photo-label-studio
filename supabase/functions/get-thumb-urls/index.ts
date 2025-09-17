import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { signPayload } from "../_shared/signing.ts";

const ORIGINS = [
  "https://photo-label-studio.lovable.app",
  // opcional: habilitar o builder em dev
  "https://lovable.dev"
];
const ALLOW_HEADERS = "authorization, apikey, content-type, x-client-info";
const ALLOW_METHODS = "POST, OPTIONS";

function corsHeaders(origin: string) {
  const o = ORIGINS.includes(origin) ? origin : ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": o,
    "Access-Control-Allow-Headers": ALLOW_HEADERS,
    "Access-Control-Allow-Methods": ALLOW_METHODS
  };
}

function getAdmin() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

async function getUserIdFromReq(req: Request) {
  const auth = req.headers.get("authorization")||"";
  const jwt = auth.startsWith("Bearer ")? auth.slice(7):"";
  const admin = getAdmin();
  const { data } = await admin.auth.getUser(jwt);
  if (!data?.user?.id) throw new Error("INVALID_JWT");
  return data.user.id;
}

serve(async (req) => {
  const origin = req.headers.get("origin") || ORIGINS[0];

  // ✅ Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { ...corsHeaders(origin) } });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ ok:false, reason:"METHOD_NOT_ALLOWED" }), {
        status: 405,
        headers: { "Content-Type":"application/json", ...corsHeaders(origin) }
      });
    }

    const body = await req.json().catch(()=> ({}));
    const fileIds: string[] = Array.isArray(body.fileIds) ? body.fileIds : [];
    if (fileIds.length === 0) {
      return new Response(JSON.stringify({ ok:false, reason:"NO_FILEIDS" }), {
        status: 400,
        headers: { "Content-Type":"application/json", ...corsHeaders(origin) }
      });
    }

    const uid = await getUserIdFromReq(req);
    const base = Deno.env.get("SUPABASE_URL")!.replace(/\/$/,"");
    const exp = Date.now() + 5 * 60 * 1000; // 5 min

    // assinatura
    const urls: Record<string,string> = {};
    for (const id of fileIds) {
      const payload = { uid, fileId: id, exp };
      const sig = await signPayload(payload);
      urls[id] = `${base}/functions/v1/thumb-open?sig=${encodeURIComponent(sig)}`;
    }

    return new Response(JSON.stringify({ ok:true, urls }), {
      status: 200,
      headers: { "Content-Type":"application/json", ...corsHeaders(origin) }
    });
  } catch (e:any) {
    const msg = e?.message || String(e);
    const code = msg === "INVALID_JWT" ? 401 : 500;
    return new Response(JSON.stringify({ ok:false, reason:"SIGN_ERR", message: msg }), {
      status: code,
      headers: { "Content-Type":"application/json", ...corsHeaders(origin) }
    });
  }
});