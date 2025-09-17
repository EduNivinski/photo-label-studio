import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { signPayload } from "../_shared/signing.ts";

const ORIGIN = "https://photo-label-studio.lovable.app";

function cors(origin: string) {
  const o = ORIGIN; // manter fixo
  return {
    "Access-Control-Allow-Origin": o,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };
}

function admin() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

async function getUid(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const jwt = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!jwt) throw new Error("INVALID_JWT");
  const { data } = await admin().auth.getUser(jwt);
  if (!data?.user?.id) throw new Error("INVALID_JWT");
  return data.user.id as string;
}

serve(async (req) => {
  const origin = req.headers.get("origin") || ORIGIN;

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== "POST")
    return new Response(JSON.stringify({ ok:false, reason:"METHOD_NOT_ALLOWED" }), { status:405, headers: cors(origin) });

  try {
    const body = await req.json().catch(()=> ({}));
    const fileIds: string[] = Array.isArray(body.fileIds) ? body.fileIds : [];
    if (!fileIds.length) return new Response(JSON.stringify({ ok:false, reason:"NO_FILEIDS" }), { status:400, headers: cors(origin) });

    const uid = await getUid(req);
    const base = Deno.env.get("SUPABASE_URL")!.replace(/\/$/,"");
    const exp = Date.now() + 5 * 60 * 1000; // 5 min

    const urls: Record<string,string> = {};
    for (const id of fileIds) {
      const sig = await signPayload({ uid, fileId: id, exp });
      // 👉 usar a rota aberta:
      urls[id] = `${base}/functions/v1/thumb-open?sig=${encodeURIComponent(sig)}`;
    }

    return new Response(JSON.stringify({ ok:true, urls }), { status:200, headers: cors(origin) });
  } catch (e:any) {
    const msg = e?.message || String(e);
    const code = msg === "INVALID_JWT" ? 401 : 500;
    return new Response(JSON.stringify({ ok:false, reason:"SIGN_ERR", message: msg }), { status: code, headers: cors(origin) });
  }
});