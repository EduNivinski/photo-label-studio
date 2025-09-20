import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { signPayload } from "../_shared/signing.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";

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
  const preflightResponse = preflight(req);
  if (preflightResponse) return preflightResponse;

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok:false, reason:"METHOD_NOT_ALLOWED" }), { 
      status:405, 
      headers: { ...corsHeaders(req.headers.get("origin")), 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await req.json().catch(()=> ({}));
    const fileIds: string[] = Array.isArray(body.fileIds) ? body.fileIds : [];
    if (!fileIds.length) {
      return new Response(JSON.stringify({ ok:false, reason:"NO_FILEIDS" }), { 
        status:400, 
        headers: { ...corsHeaders(req.headers.get("origin")), 'Content-Type': 'application/json' }
      });
    }

    const uid = await getUid(req);
    const base = Deno.env.get("SUPABASE_URL")!.replace(/\/$/,"");
    const ttlSec = 600; // 10 min TTL
    const exp = Date.now() + ttlSec * 1000;

    const urls: Record<string,string> = {};
    for (const id of fileIds) {
      const sig = await signPayload({ uid, fileId: id, exp });
      urls[id] = `${base}/functions/v1/thumb-open?sig=${encodeURIComponent(sig)}`;
    }

    return new Response(JSON.stringify({ 
      ok: true, 
      ttlSec, 
      urls 
    }), {
      headers: { ...corsHeaders(req.headers.get("origin")), 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error("get-thumb-urls error:", error);
    const msg = error?.message || String(error);
    const code = msg === "INVALID_JWT" ? 401 : 500;
    return new Response(JSON.stringify({ 
      ok: false, 
      reason: msg === "INVALID_JWT" ? "INVALID_JWT" : "SIGN_ERR", 
      message: msg 
    }), {
      status: code,
      headers: { ...corsHeaders(req.headers.get("origin")), 'Content-Type': 'application/json' }
    });
  }
});