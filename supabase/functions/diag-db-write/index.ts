import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { upsertTokens } from "../_shared/token_provider_v2.ts";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
  }
});

serve(async (req) => {
  if (req.method === "OPTIONS") return json(204, {});
  
  try {
    const { user_id } = await req.json().catch(() => ({}));
    if (!user_id) return json(400, { status: 400, reason: "MISSING_USER_ID" });

    // Test database write with dummy data
    await upsertTokens(
      user_id, 
      "dummy_access_token", 
      "dummy_refresh_token", 
      "dummy_scope", 
      new Date(Date.now() + 3600000).toISOString()
    );

    console.log(`DB write test successful for user: ${user_id}`);
    return json(200, { status: 200, ok: true, message: "Database write test successful" });

  } catch (e: any) {
    console.error("diag-db-write error:", { msg: e?.message, name: e?.name, stack: e?.stack });
    return json(500, { status: 500, reason: "DB_WRITE_FAILED", detail: e?.message });
  }
});