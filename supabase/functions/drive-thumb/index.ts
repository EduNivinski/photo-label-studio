import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ensureAccessToken } from "../_shared/token_provider_v2.ts";

function getAdmin() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("ENV_MISSING");
  return createClient(url, key);
}

async function getUserIdFromReq(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const jwt = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!jwt) throw new Error("INVALID_JWT");
  const admin = getAdmin();
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data?.user?.id) throw new Error("INVALID_JWT");
  return data.user.id;
}

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "https://photo-label-studio.lovable.app",
          "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
          "Access-Control-Allow-Methods": "GET, OPTIONS"
        }
      });
    }

    const url = new URL(req.url);
    const fileId = url.searchParams.get("fileId");
    if (!fileId) return new Response("Missing fileId", { status: 400 });

    const userId = await getUserIdFromReq(req);
    const accessToken = await ensureAccessToken(userId);

    // Pega thumbnailLink atual (curto-vivo)
    const metaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=thumbnailLink&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const meta = await metaRes.json().catch(() => ({}));
    if (!metaRes.ok || !meta?.thumbnailLink) return new Response("No thumbnail", { status: 404 });

    // Faz proxy da imagem
    const imgRes = await fetch(meta.thumbnailLink);
    if (!imgRes.ok) return new Response("Thumb fetch failed", { status: 502 });

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
  } catch (e: any) {
    const msg = e?.message || String(e);
    const status = msg.includes("INVALID_JWT") ? 401 : 500;
    return new Response(`ERR:${msg}`, {
      status,
      headers: { "Access-Control-Allow-Origin": "https://photo-label-studio.lovable.app" }
    });
  }
});