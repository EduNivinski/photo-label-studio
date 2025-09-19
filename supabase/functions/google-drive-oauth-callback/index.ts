import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { exchangeCodeAndUpsert } from "../_shared/drive_oauth.ts";

const ORIGIN = "https://photo-label-studio.lovable.app";

const h = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Headers": "content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "GET, OPTIONS"
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });

  try {
    const u = new URL(req.url);
    const code = u.searchParams.get("code");
    const state = u.searchParams.get("state");
    if (!code || !state) {
      return new Response("Missing code/state", { status: 400, headers: h });
    }

    // troca o code por tokens e UPSERT encriptado (usa state pra achar userId)
    await exchangeCodeAndUpsert({ code, state });

    const html = `<!doctype html><meta charset="utf-8" />
<script>
try {
  if (window.opener) window.opener.postMessage({type:"drive_connected"}, "${ORIGIN}");
  window.close();
} catch(e) {}
</script>
<body style="font-family:system-ui;margin:24px">
  Conexão realizada. Você pode fechar esta janela.
</body>`;
    return new Response(html, { status: 200, headers: { ...h, "Content-Type":"text/html; charset=utf-8" } });

  } catch (e:any) {
    return new Response(JSON.stringify({ ok:false, reason: e?.message || "CALLBACK_ERR" }), {
      status: 500, headers: { ...h, "Content-Type":"application/json" }
    });
  }
});