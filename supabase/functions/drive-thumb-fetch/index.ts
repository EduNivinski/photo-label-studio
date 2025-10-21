import { corsHeaders, json } from "../_shared/http.ts";

async function handler(req: Request): Promise<Response> {
  // 1) OPTIONS obrigatória para preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // 2) Suportar GET e POST (para o front poder usar ambos)
    let itemId: string | undefined;
    let size = 256;

    if (req.method === "GET") {
      const url = new URL(req.url);
      itemId = url.searchParams.get("itemId") ?? undefined;
      size = parseInt(url.searchParams.get("size") ?? "256", 10);
    } else if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      itemId = body.itemId;
      size = parseInt(String(body.size ?? "256"), 10);
    } else {
      return json(405, { ok:false, code:"METHOD_NOT_ALLOWED" });
    }

    if (!itemId) {
      return json(400, { ok:false, code:"MISSING_ITEM_ID", message:"itemId é obrigatório" });
    }

    // 3) Normalizar prefixo gdrive:
    itemId = String(itemId).replace(/^gdrive:/, "");

    // 4) Placeholder: retornar ok com URL de placeholder (até implementarmos geração)
    //    (Pode ser um PNG público do bucket "public" ou data URL)
    const placeholder =
      "data:image/svg+xml;base64," +
      btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
        <rect width="100%" height="100%" fill="#f3f4f6"/>
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
              font-family="sans-serif" font-size="14" fill="#9ca3af">
          thumb ${size}
        </text>
      </svg>`);

    return json(200, {
      ok: true,
      url: placeholder,
      rev: "placeholder",
      width: size,
      height: size,
      traceId: crypto.randomUUID(),
    });
  } catch (err) {
    // NUNCA deixar sem headers CORS
    console.error("[drive-thumb-fetch][error]", err);
    return json(500, { ok:false, code:"UNEXPECTED_ERROR", message:String(err), traceId: crypto.randomUUID() });
  }
}

// entrypoint (Edge runtime V2)
Deno.serve(handler);