import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyPayload } from "../_shared/signing.ts";
import { ensureAccessToken } from "../_shared/token_provider_v2.ts";

function getAdmin() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const sig = url.searchParams.get("sig") || "";
    const { uid, fileId } = await verifyPayload(sig);

    const admin = getAdmin();
    // opcional: checar que o uid existe e tem tokens válidos
    const accessToken = await ensureAccessToken(uid);

    const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=thumbnailLink&supportsAllDrives=true`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const meta = await metaRes.json().catch(()=> ({}));
    if (!metaRes.ok || !meta?.thumbnailLink) {
      return new Response("No thumbnail", { 
        status:404,
        headers: { "Access-Control-Allow-Origin": "https://photo-label-studio.lovable.app" }
      });
    }

    const imgRes = await fetch(meta.thumbnailLink);
    if (!imgRes.ok) {
      return new Response("Thumb fetch failed", { 
        status:502,
        headers: { "Access-Control-Allow-Origin": "https://photo-label-studio.lovable.app" }
      });
    }

    const bytes = new Uint8Array(await imgRes.arrayBuffer());
    const type = imgRes.headers.get("content-type") || "image/jpeg";
    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": type,
        "Cache-Control": "private, max-age=300",
        "Access-Control-Allow-Origin": "https://photo-label-studio.lovable.app"
      }
    });
  } catch (e:any) {
    const status = /BAD_SIG|BAD_PAYLOAD|EXPIRED/.test(e?.message||"") ? 401 : 500;
    return new Response(`ERR:${e?.message||String(e)}`, { 
      status, 
      headers: { 
        "Access-Control-Allow-Origin":"https://photo-label-studio.lovable.app" 
      }
    });
  }
});