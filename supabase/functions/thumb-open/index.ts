import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { verifyPayload } from "../_shared/signing.ts";
import { ensureAccessToken } from "../_shared/token_provider_v2.ts";

// Public endpoint to serve Google Drive thumbnails via signed payload (no JWT)
const APP_ORIGIN = "https://photo-label-studio.lovable.app";

serve(async (req) => {
  try {
    // CORS preflight (not typically needed for <img>, but safe to support)
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": APP_ORIGIN,
          "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
        },
      });
    }

    const url = new URL(req.url);
    const sig = url.searchParams.get("sig") || "";
    const { uid, fileId } = await verifyPayload(sig); // ✅ signature-based auth only

    const accessToken = await ensureAccessToken(uid);

    const metaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=thumbnailLink&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const meta = await metaRes.json().catch(() => ({}));
    if (!metaRes.ok || !meta?.thumbnailLink) {
      return new Response("No thumbnail", {
        status: 404,
        headers: { "Access-Control-Allow-Origin": APP_ORIGIN },
      });
    }

    const imgRes = await fetch(meta.thumbnailLink);
    if (!imgRes.ok) {
      return new Response("Thumb fetch failed", {
        status: 502,
        headers: { "Access-Control-Allow-Origin": APP_ORIGIN },
      });
    }

    const bytes = new Uint8Array(await imgRes.arrayBuffer());
    const type = imgRes.headers.get("content-type") || "image/jpeg";

    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": type,
        "Cache-Control": "private, max-age=300",
        "Access-Control-Allow-Origin": APP_ORIGIN,
      },
    });
  } catch (e: any) {
    const status = /BAD_SIG|BAD_PAYLOAD|EXPIRED/.test(e?.message || "") ? 401 : 500;
    return new Response(`ERR:${e?.message || String(e)}` , {
      status,
      headers: { "Access-Control-Allow-Origin": APP_ORIGIN },
    });
  }
});