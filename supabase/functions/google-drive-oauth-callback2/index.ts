import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { exchangeCodeAndUpsert } from "../_shared/drive_oauth.ts";

const ORIGIN = "https://photo-label-studio.lovable.app";
const H = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Headers": "content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: H });

  try {
    const u = new URL(req.url);
    const code = u.searchParams.get("code");
    const state = u.searchParams.get("state");
    if (!code) return new Response(JSON.stringify({ ok:false, reason:"BAD_CODE" }), { status:400, headers:{...H,"Content-Type":"application/json"} });
    if (!state) return new Response(JSON.stringify({ ok:false, reason:"BAD_STATE" }), { status:400, headers:{...H,"Content-Type":"application/json"} });

    await exchangeCodeAndUpsert({ code, state });

    const html = `<!doctype html>
<meta charset="utf-8" />
<script>
  try {
    if (window.opener) window.opener.postMessage({ type:"drive_connected" }, "${ORIGIN}");
    window.close();
  } catch (e) {}
</script>
<body style="font-family:system-ui;margin:24px">
  Conexão realizada. Você pode fechar esta janela.
</body>`;
    return new Response(html, { status:200, headers:{...H,"Content-Type":"text/html; charset=utf-8"} });

  } catch (e:any) {
    const msg = e?.message || "CALLBACK_ERR";
    const code = /state/i.test(msg) ? 400 : 500;
    return new Response(JSON.stringify({ ok:false, reason: msg }), { status: code, headers:{...H,"Content-Type":"application/json"} });
  }
});