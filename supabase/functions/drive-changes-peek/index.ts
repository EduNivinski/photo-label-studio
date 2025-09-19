import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { listChanges } from "../_shared/drive_client.ts";
import { ensureAccessToken } from "../_shared/token_provider_v2.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

async function getUserIdFromJwt(req: Request): Promise<string | null> {
  try {
    const auth = req.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) return null;
    const token = auth.slice("Bearer ".length);
    const adminClient = admin;
    const { data: { user } } = await adminClient.auth.getUser(token);
    return user?.id ?? null;
  } catch {
    return null;
  }
}

async function getState(userId: string) {
  const { data, error } = await admin.from("drive_sync_state")
    .select("start_page_token")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.start_page_token) throw new Error("NO_START_PAGE_TOKEN");
  return data.start_page_token as string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const userId = await getUserIdFromJwt(req);
    if (!userId) return new Response(JSON.stringify({ ok: false, reason: "INVALID_JWT" }), { 
      status: 401, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

    const token = await ensureAccessToken(userId);
    let pageToken = await getState(userId);

    let newStartPageToken: string | undefined;
    let newCount = 0;
    let additions = 0;
    let removals = 0;
    let modifications = 0;

    console.log(`Peeking changes for user ${userId} from page token ${pageToken.slice(0, 10)}...`);

    // Apenas contar mudanças, NÃO aplicar ao banco
    do {
      const page = await listChanges(pageToken, token);
      
      for (const ch of page.changes || []) {
        if (ch.removed) {
          removals++;
        } else if (ch.file) {
          // Verificar se é novo item ou modificação
          const { data: existingItem } = await admin.from("drive_items")
            .select("file_id")
            .eq("user_id", userId)
            .eq("file_id", ch.fileId as string)
            .maybeSingle();
          
          if (existingItem) {
            modifications++;
          } else {
            additions++;
          }
        }
        newCount++;
      }
      
      if (page.newStartPageToken) newStartPageToken = page.newStartPageToken;
      pageToken = page.nextPageToken || "";
    } while (pageToken);

    console.log(`Peek completed: ${newCount} total changes (${additions} new, ${modifications} modified, ${removals} removed)`);

    return new Response(JSON.stringify({ 
      ok: true, 
      newCount,
      additions,
      modifications, 
      removals,
      startPageToken: newStartPageToken || await getState(userId)
    }), { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
    
  } catch (e: any) {
    console.error("Changes peek error:", e?.message || String(e));
    return new Response(JSON.stringify({ 
      ok: false, 
      reason: "PEEK_ERROR", 
      message: e?.message || String(e) 
    }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});