import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, preflight, jsonCors } from "../_shared/cors.ts";
import { ensureAccessToken } from "../_shared/token_provider_v2.ts";

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    // Get user authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonCors(req, 401, { error: 'Authorization header required' });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      return jsonCors(req, 401, { error: 'Invalid authorization' });
    }

    // Parse request body
    const body = await req.json();
    const { fileId, fileIds } = body;

    // Normalize to array
    const targetFileIds: string[] = fileId ? [fileId] : (fileIds || []);

    if (targetFileIds.length === 0) {
      return jsonCors(req, 400, { error: 'fileId or fileIds required' });
    }

    console.log(`🗑️ Delete request from user ${user.id} for ${targetFileIds.length} files`);

    // Check rate limit (max 20 deletes per minute)
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
    const { count: recentDeletes } = await supabase
      .from('drive_delete_rate_limit')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('deleted_at', oneMinuteAgo);

    if ((recentDeletes || 0) + targetFileIds.length > 20) {
      return jsonCors(req, 429, { 
        error: 'Rate limit exceeded. Maximum 20 deletes per minute.',
        retryAfter: 60 
      });
    }

    // Get access token
    const accessToken = await ensureAccessToken(user.id);

    // Verify all files belong to the user
    const { data: driveItems, error: itemsError } = await supabase
      .from('drive_items')
      .select('file_id, name, user_id')
      .eq('user_id', user.id)
      .in('file_id', targetFileIds);

    if (itemsError) {
      console.error('❌ Error fetching drive items:', itemsError);
      return jsonCors(req, 500, { error: 'Failed to verify file ownership' });
    }

    if (!driveItems || driveItems.length !== targetFileIds.length) {
      return jsonCors(req, 403, { 
        error: 'One or more files not found or not owned by user' 
      });
    }

    // Generate bulk operation ID for audit
    const bulkOperationId = crypto.randomUUID();

    // Delete files from Google Drive (batch processing)
    const results = {
      success: true,
      deleted: 0,
      errors: [] as Array<{ fileId: string; error: string }>
    };

    // Process in batches of 10 to avoid overwhelming the API
    const batchSize = 10;
    for (let i = 0; i < targetFileIds.length; i += batchSize) {
      const batch = targetFileIds.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (fId) => {
        try {
          const item = driveItems.find(di => di.file_id === fId);
          if (!item) {
            results.errors.push({ fileId: fId, error: 'File not found in database' });
            return;
          }

          // Delete from Google Drive (moves to trash)
          const driveResponse = await fetch(
            `https://www.googleapis.com/drive/v3/files/${fId}?supportsAllDrives=true`,
            {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${accessToken}`
              }
            }
          );

          if (!driveResponse.ok) {
            const errorText = await driveResponse.text();
            console.error(`❌ Drive API error for ${fId}:`, driveResponse.status, errorText);
            
            let errorMessage = 'Drive API error';
            if (driveResponse.status === 404) {
              errorMessage = 'File not found in Drive';
            } else if (driveResponse.status === 403) {
              errorMessage = 'Permission denied';
            }
            
            results.errors.push({ fileId: fId, error: errorMessage });
            return;
          }

          console.log(`✅ Deleted ${fId} from Drive`);

          // Update local database
          const { error: updateError } = await supabase
            .from('drive_items')
            .update({
              status: 'deleted_from_drive',
              trashed: true,
              deleted_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('file_id', fId)
            .eq('user_id', user.id);

          if (updateError) {
            console.error(`⚠️ Error updating drive_items for ${fId}:`, updateError);
          }

          // Clean up labels
          await supabase
            .from('labels_items')
            .delete()
            .eq('item_key', fId)
            .eq('source', 'gdrive');

          // Record audit log
          await supabase
            .from('drive_delete_audit')
            .insert({
              user_id: user.id,
              file_id: fId,
              file_name: item.name,
              bulk_operation_id: targetFileIds.length > 1 ? bulkOperationId : null,
              deleted_at: new Date().toISOString()
            });

          // Update rate limit counter
          await supabase
            .from('drive_delete_rate_limit')
            .insert({
              user_id: user.id,
              deleted_at: new Date().toISOString()
            });

          results.deleted++;

        } catch (error) {
          console.error(`❌ Error processing ${fId}:`, error);
          results.errors.push({ 
            fileId: fId, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }));
    }

    // Clean up old rate limit entries (older than 1 minute)
    await supabase
      .from('drive_delete_rate_limit')
      .delete()
      .eq('user_id', user.id)
      .lt('deleted_at', oneMinuteAgo);

    console.log(`✅ Bulk delete completed: ${results.deleted} deleted, ${results.errors.length} errors`);

    return jsonCors(req, 200, results);

  } catch (error) {
    console.error('❌ Error in drive-delete-permanently:', error);
    return jsonCors(req, 500, { 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
