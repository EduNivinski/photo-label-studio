// Deno + Supabase Edge Functions
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, content-type",
    },
  });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  try {
    // Verificar envs essenciais sem expor valores
    const hasUrl = !!Deno.env.get("SUPABASE_URL");
    const hasAnon = !!Deno.env.get("SUPABASE_ANON_KEY");
    const hasServiceRole = !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    return json(200, {
      ok: true,
      function: "diag_ping",
      env: { 
        SUPABASE_URL: hasUrl, 
        SUPABASE_ANON_KEY: hasAnon,
        SUPABASE_SERVICE_ROLE_KEY: hasServiceRole
      },
      now: new Date().toISOString(),
    });
  } catch (e) {
    console.error("diag_ping error", { msg: e?.message, name: e?.name });
    return json(500, { ok: false, error: "INTERNAL_ERROR" });
  }
});