import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { listChanges, getStartPageToken } from "../_shared/drive_client.ts";
import { ensureAccessToken } from "../_shared/token_provider_v2.ts";
import { corsHeaders } from "../_shared/http.ts";

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
    .select("start_page_token, root_folder_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { 
    startPageToken: data?.start_page_token || null, 
    rootFolderId: data?.root_folder_id || null 
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const traceId = crypto.randomUUID();

  try {
    const userId = await getUserIdFromJwt(req);
    if (!userId) {
      return new Response(JSON.stringify({ 
        ok: false, 
        code: "INVALID_JWT",
        message: "Authentication required",
        traceId 
      }), { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const token = await ensureAccessToken(userId);
    const state = await getState(userId);

    console.log('[changes-peek][start]', { 
      traceId, 
      user_id: userId, 
      hasToken: !!state.startPageToken, 
      rootFolderId: state.rootFolderId 
    });

    // If no token exists, return zero changes (not an error)
    if (!state.startPageToken) {
      console.log('[changes-peek][noToken]', { traceId });
      return new Response(JSON.stringify({ 
        ok: true, 
        newCount: 0,
        additions: 0,
        modifications: 0,
        removals: 0,
        message: 'No change token available yet',
        traceId 
      }), { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    let pageToken = state.startPageToken;
    let newStartPageToken: string | undefined;
    let newCount = 0;
    let additions = 0;
    let removals = 0;
    let modifications = 0;

    // Count changes only, don't apply to database
    do {
      try {
        const page = await listChanges(pageToken, token);
        
        for (const ch of page.changes || []) {
          if (ch.removed) {
            removals++;
          } else if (ch.file) {
            // Check if it's a new item or modification
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
      } catch (apiError: any) {
        // Handle invalid token gracefully
        if (apiError?.message?.includes('invalid') || apiError?.message?.includes('startPageToken')) {
          console.log('[changes-peek][invalidToken]', { traceId, error: apiError.message });
          return new Response(JSON.stringify({ 
            ok: true, 
            newCount: 0,
            additions: 0,
            modifications: 0,
            removals: 0,
            reset: true,
            message: 'Token needs reset',
            traceId 
          }), { 
            status: 200, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          });
        }
        throw apiError;
      }
    } while (pageToken);

    console.log('[changes-peek][done]', { traceId, newCount, additions, modifications, removals });

    return new Response(JSON.stringify({ 
      ok: true, 
      newCount,
      additions,
      modifications, 
      removals,
      startPageToken: newStartPageToken || state.startPageToken,
      traceId
    }), { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
    
  } catch (e: any) {
    console.error('[changes-peek][error]', { traceId, error: e?.message || String(e) });
    return new Response(JSON.stringify({ 
      ok: false, 
      code: "PEEK_ERROR",
      message: e?.message || "Failed to peek changes",
      traceId 
    }), { 
      status: 200, // Return 200 even on error to avoid breaking UI
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});