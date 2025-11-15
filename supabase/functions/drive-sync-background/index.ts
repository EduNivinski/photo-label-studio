import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth, httpJson, httpNoContent } from "../_shared/http.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";

// Background sync worker (recursive)
async function backgroundSyncWorker(userId: string, projectUrl: string, serviceKey: string) {
  const admin = createClient(projectUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  console.log('[background-sync] Worker started for user:', userId);
  
  while (true) {
    try {
      // Read current state
      const { data: state, error: stateError } = await admin
        .from("drive_sync_state")
        .select("status, pending_folders")
        .eq("user_id", userId)
        .single();
      
      if (stateError || !state) {
        console.error('[background-sync] Failed to read state:', stateError);
        break;
      }
      
      if (state.status === 'error') {
        console.log('[background-sync] State is error, stopping');
        break;
      }
      
      const pending = (state.pending_folders || []).length;
      console.log('[background-sync] Pending folders:', pending);
      
      if (pending === 0) {
        // Completed! Call finalize to detect orphans
        console.log('[background-sync] Sync completed, calling finalize...');
        
        const finalizeResponse = await fetch(`${projectUrl}/functions/v1/drive-sync-finalize`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
            'x-user-id': userId,
          }
        });
        
        if (!finalizeResponse.ok) {
          console.error('[background-sync] Finalize failed:', await finalizeResponse.text());
        } else {
          const finalizeData = await finalizeResponse.json();
          console.log('[background-sync] Finalize result:', finalizeData);
        }
        
        const { data: currentState } = await admin
          .from("drive_sync_state")
          .select("stats")
          .eq("user_id", userId)
          .single();
        
        await admin.from("drive_sync_state")
          .update({ 
            status: 'idle',
            stats: {
              ...(currentState?.stats || {}),
              completedAt: new Date().toISOString()
            },
            updated_at: new Date().toISOString() 
          })
          .eq("user_id", userId);
        console.log('[background-sync] Sync completed!');
        break;
      }
      
      // Process next batch (call existing edge function via invoke)
      // Note: We need to get user's auth token to call the function
      const { data: tokenData } = await admin
        .from("user_drive_tokens")
        .select("id")
        .eq("user_id", userId)
        .single();
      
      if (!tokenData) {
        console.error('[background-sync] No user tokens found');
        break;
      }
      
      // Call drive-sync-run using service role
      const syncResponse = await fetch(`${projectUrl}/functions/v1/drive-sync-run`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          'x-user-id': userId, // Pass user ID for the function to use
        },
        body: JSON.stringify({ budgetFolders: 5 }),
      });
      
      if (!syncResponse.ok) {
        const errorText = await syncResponse.text();
        console.error('[background-sync] drive-sync-run failed:', syncResponse.status, errorText);
        
        await admin.from("drive_sync_state")
          .update({ 
            status: 'error', 
            last_error: `Sync run failed: ${errorText}`,
            updated_at: new Date().toISOString() 
          })
          .eq("user_id", userId);
        break;
      }
      
      const syncData = await syncResponse.json();
      console.log('[background-sync] Batch processed:', syncData);
      
      // Wait 1s between batches (avoid rate limit)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (err) {
      console.error('[background-sync] Exception:', err);
      
      await admin.from("drive_sync_state")
        .update({ 
          status: 'error', 
          last_error: String(err),
          updated_at: new Date().toISOString() 
        })
        .eq("user_id", userId);
      break;
    }
  }
  
  console.log('[background-sync] Worker finished for user:', userId);
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  
  if (req.method === 'OPTIONS') {
    return httpNoContent(origin);
  }

  const cid = crypto.randomUUID();

  try {
    const { userId } = await requireAuth(req);
    
    await checkRateLimit({
      userId,
      ip: req.headers.get('x-forwarded-for') || 'unknown',
      endpoint: 'drive-sync-background',
      limit: 5,
      windowSec: 3600
    });

    const projectUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Mark as "syncing"
    const admin = createClient(projectUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    const { error: updateError } = await admin.from("drive_sync_state")
      .update({ 
        status: 'running', 
        updated_at: new Date().toISOString() 
      })
      .eq("user_id", userId);
    
    if (updateError) {
      console.error('[background-sync] Failed to update state:', updateError);
      throw new Error('Failed to start background sync');
    }
    
    // Start worker in background
    EdgeRuntime.waitUntil(
      backgroundSyncWorker(userId, projectUrl, serviceKey)
    );
    
    // Return IMMEDIATELY
    return httpJson(202, {
      ok: true,
      message: 'Background sync started',
      traceId: cid,
      status: 'running'
    }, origin);
    
  } catch (err: any) {
    console.error('[drive-sync-background][error]', { cid, error: String(err) });
    
    const statusCode = err.message === 'UNAUTHORIZED' ? 401 : 500;
    
    return httpJson(statusCode, {
      ok: false,
      error: err.message === 'UNAUTHORIZED' ? 'UNAUTHORIZED' : 'BACKGROUND_START_FAILED',
      traceId: cid
    }, origin);
  }
});
