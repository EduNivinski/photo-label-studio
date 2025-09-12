import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { preflight, jsonCors } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function admin() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;

  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    const supa = admin();
    const { data: { user } } = await supa.auth.getUser(token);
    const userId = user?.id;
    if (!userId) return jsonCors(req, 401, { ok:false, reason:"INVALID_JWT" });

    const { data, error } = await supa
      .from("drive_oauth_audit")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) return jsonCors(req, 500, { ok:false, reason:"QUERY_FAIL" });

    return jsonCors(req, 200, { ok:true, audit:data });
  } catch (e:any) {
    return jsonCors(req, 500, { ok:false, reason:e?.message || "INTERNAL_ERROR" });
  }
});