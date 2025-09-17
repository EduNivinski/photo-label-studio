import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyPayload } from "../_shared/signing.ts";
import { ensureAccessToken } from "../_shared/token_provider_v2.ts";

const ORIGIN = "https://photo-label-studio.lovable.app";

function cors() {
  return { "Access-Control-Allow-Origin": ORIGIN };
}

function admin() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const sig = url.searchParams.get("sig") || "";
    const { uid, fileId } = await verifyPayload(sig); // ✅ sem Authorization/JWT

    // opcional: validar que uid existe
    const { data: u } = await admin().auth.admin.getUserById(uid);
    if (!u?.user?.id) throw new Error("BAD_UID");

    const accessToken = await ensureAccessToken(uid);

    const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=thumbnailLink&supportsAllDrives=true`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const meta = await metaRes.json().catch(()=> ({}));
    if (!metaRes.ok || !meta?.thumbnailLink) {
      return new Response(JSON.stringify({ ok:false, reason:"NO_THUMBNAIL" }), { status:404, headers: { "Content-Type":"application/json", ...cors() } });
    }

    const imgRes = await fetch(meta.thumbnailLink);
    if (!imgRes.ok) {
      return new Response(JSON.stringify({ ok:false, reason:"THUMB_FETCH_FAILED" }), { status:502, headers: { "Content-Type":"application/json", ...cors() } });
    }

    const buf = new Uint8Array(await imgRes.arrayBuffer());
    const type = imgRes.headers.get("content-type") || "image/jpeg";
    return new Response(buf, { status:200, headers: { "Content-Type": type, "Cache-Control":"private, max-age=300", ...cors() } });
  } catch (e:any) {
    const msg = e?.message || String(e);
    const isSig = /BAD_SIG|BAD_PAYLOAD|EXPIRED|ENV_MISSING_THUMB_SIGNING_KEY|BAD_UID/.test(msg);
    const status = isSig ? 401 : 500;
    return new Response(JSON.stringify({ ok:false, reason: msg }), { status, headers: { "Content-Type":"application/json", ...cors() } });
  }
});