import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ensureAccessToken } from "../_shared/token_provider_v2.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { itemId } = await req.json();

    if (!itemId) {
      return new Response(
        JSON.stringify({ error: 'Item ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user from auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🗑️ Delete request for item: ${itemId} by user: ${user.id}`);

    // Parse itemId to determine source and key
    const [source, key] = itemId.includes(':') ? itemId.split(':', 2) : ['db', itemId];
    
    console.log(`📍 Parsed: source=${source}, key=${key}`);

    if (source === 'db') {
      // Delete from photos table
      const { error: deletePhotoError } = await supabase
        .from('photos')
        .delete()
        .eq('id', key)
        .eq('user_id', user.id);

      if (deletePhotoError) {
        console.error('❌ Error deleting photo from DB:', deletePhotoError);
        return new Response(
          JSON.stringify({ error: 'Failed to delete photo from database' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`✅ Deleted photo from DB: ${key}`);
    } else if (source === 'gdrive') {
      // Delete from drive_items table (marks as deleted/trashed)
      console.log(`📁 Marking drive item as deleted: file_id=${key}, user_id=${user.id}`);
      
      const { data: updateResult, error: deleteDriveError } = await supabase
        .from('drive_items')
        .update({ status: 'deleted', trashed: true, updated_at: new Date().toISOString() })
        .eq('file_id', key)
        .eq('user_id', user.id)
        .select();

      if (deleteDriveError) {
        console.error('❌ Error marking drive item as deleted:', deleteDriveError);
        return new Response(
          JSON.stringify({ error: 'Failed to delete drive item', details: deleteDriveError }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`✅ Marked drive item as deleted:`, {
        key,
        rowsAffected: updateResult?.length ?? 0,
        updatedItem: updateResult?.[0] ?? null
      });

      // Additionally, attempt to move the file to trash in Google Drive (best-effort)
      try {
        const accessToken = await ensureAccessToken(user.id);
        const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(key)}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ trashed: true })
        });

        if (!resp.ok) {
          const errText = await resp.text().catch(() => '');
          console.warn('⚠️ Drive API trash failed', { status: resp.status, body: errText });
        } else {
          console.log('🗂️ Drive API: file moved to trash successfully', { file_id: key });
        }
      } catch (driveApiErr) {
        console.warn('⚠️ Skipping Drive API trash due to error:', driveApiErr);
      }
    }

    // Clean up label assignments for this item
    const { error: labelError } = await supabase
      .from('labels_items')
      .delete()
      .eq('item_key', key)
      .eq('source', source);

    if (labelError) {
      console.error('⚠️ Error cleaning up label assignments:', labelError);
    } else {
      console.log(`🏷️ Cleaned up label assignments for ${source}:${key}`);
    }

    return new Response(
      JSON.stringify({ success: true, itemId, source, key }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in delete-unified-item:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});