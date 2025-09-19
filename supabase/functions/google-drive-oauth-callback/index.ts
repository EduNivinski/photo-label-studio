import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { exchangeCodeAndUpsert } from "../_shared/drive_oauth.ts";

const ORIGIN = "https://photo-label-studio.lovable.app";

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": ORIGIN,
          "Access-Control-Allow-Headers": "content-type, apikey, x-client-info",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
        }
      });
    }

    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const oauthError = url.searchParams.get("error");

    if (oauthError) {
      return new Response(`Missing code/state: ${oauthError}`, { 
        status: 400, 
        headers: { "Access-Control-Allow-Origin": ORIGIN } 
      });
    }

    if (!code || !state) {
      return new Response("Missing code/state", { 
        status: 400, 
        headers: { "Access-Control-Allow-Origin": ORIGIN } 
      });
    }

    // Exchange code for tokens and upsert
    await exchangeCodeAndUpsert({ code, state });

    // HTML that closes window and notifies opener
    const html = `
<!doctype html><meta charset="utf-8" />
<script>
try {
  if (window.opener) {
    window.opener.postMessage({ type: "drive_connected" }, "${ORIGIN}");
  }
  window.close();
} catch (e) { 
  document.body.innerText = "Connected. You can close this window."; 
}
</script>`;

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Access-Control-Allow-Origin": ORIGIN
      }
    });

  } catch (e) {
    console.error("OAuth callback error:", e);
    return new Response(JSON.stringify({ ok: false, reason: String(e?.message || e) }), {
      status: 500,
      headers: { 
        "Content-Type": "application/json", 
        "Access-Control-Allow-Origin": ORIGIN 
      }
    });
  }
});