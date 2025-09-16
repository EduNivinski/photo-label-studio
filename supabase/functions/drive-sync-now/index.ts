import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

async function checkSyncState(userId: string) {
  const { data, error } = await admin.from("drive_sync_state")
    .select("start_page_token, last_full_scan_at, last_changes_at")
    .eq("user_id", userId)
    .maybeSingle();
  
  if (error) throw new Error(error.message);
  return data;
}

async function callFunction(functionName: string, authHeader: string, body?: any) {
  const baseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  if (!baseUrl) throw new Error("SUPABASE_URL not configured");
  
  const url = `${baseUrl}/functions/v1/${functionName}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  
  const result = await response.json();
  return { status: response.status, data: result };
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

    const authHeader = req.headers.get("authorization") || "";
    const syncState = await checkSyncState(userId);
    
    let indexResult: any = null;
    let changesResult: any = null;

    console.log(`Starting sync orchestration for user ${userId}`);
    
    // Se não tem start_page_token, precisa fazer full scan primeiro
    if (!syncState?.start_page_token) {
      console.log("No start page token found, running full index scan...");
      const indexResponse = await callFunction("drive-index-folder", authHeader);
      
      if (indexResponse.status !== 200) {
        throw new Error(`Index failed: ${JSON.stringify(indexResponse.data)}`);
      }
      
      indexResult = indexResponse.data;
      console.log(`Index completed: ${indexResult.totalFiles} files, ${indexResult.totalFolders} folders`);
    } else {
      console.log("Start page token exists, skipping full scan");
    }

    // Agora puxa as mudanças delta
    console.log("Running delta changes pull...");
    const changesResponse = await callFunction("drive-changes-pull", authHeader);
    
    if (changesResponse.status !== 200) {
      console.warn(`Changes pull failed: ${JSON.stringify(changesResponse.data)}`);
      // Não falha completamente se o delta der erro, mas registra
    } else {
      changesResult = changesResponse.data;
      console.log(`Delta sync completed: ${changesResult.processed} changes processed`);
    }

    const summary = {
      ok: true,
      fullScanPerformed: !!indexResult,
      deltaSync: !!changesResult,
      summary: {
        ...(indexResult && {
          totalFiles: indexResult.totalFiles,
          totalFolders: indexResult.totalFolders,
        }),
        ...(changesResult && {
          changesProcessed: changesResult.processed,
        }),
      },
      timestamp: new Date().toISOString(),
    };

    console.log("Sync orchestration completed:", summary);

    return new Response(JSON.stringify(summary), { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
    
  } catch (e: any) {
    console.error("Sync orchestration error:", e?.message || String(e));
    return new Response(JSON.stringify({ 
      ok: false, 
      reason: "SYNC_ERROR", 
      message: e?.message || String(e) 
    }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});