import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ensureAccessToken } from "../_shared/token_provider_v2.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to delete file from Google Drive
async function deleteFromGoogleDrive(fileId: string, accessToken: string): Promise<boolean> {
  try {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (response.ok || response.status === 204) {
      console.log(`✅ Successfully deleted file ${fileId} from Google Drive`);
      return true;
    } else {
      const errorBody = await response.text();
      console.error(`❌ Failed to delete from Google Drive: ${response.status} - ${errorBody}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error deleting from Google Drive:`, error);
    return false;
  }
}

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
      // First, get the access token to delete from Google Drive
      console.log(`📁 Attempting to delete drive item: file_id=${key}, user_id=${user.id}`);
      
      try {
        const accessToken = await ensureAccessToken(user.id);
        console.log(`🔑 Got access token for user ${user.id}`);
        
        // Delete from Google Drive
        const driveDeleted = await deleteFromGoogleDrive(key, accessToken);
        
        if (driveDeleted) {
          console.log(`✅ File deleted from Google Drive: ${key}`);
          
          // Now delete from our database (permanently remove the record)
          const { error: deleteDriveError } = await supabase
            .from('drive_items')
            .delete()
            .eq('file_id', key)
            .eq('user_id', user.id);

          if (deleteDriveError) {
            console.error('❌ Error deleting drive item from DB:', deleteDriveError);
            return new Response(
              JSON.stringify({ error: 'Failed to delete drive item from database', details: deleteDriveError }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          console.log(`✅ Deleted drive item from database: ${key}`);
        } else {
          // If Drive deletion failed, just mark as deleted in our DB
          console.log(`⚠️ Failed to delete from Drive, marking as deleted in DB only`);
          
          const { error: updateError } = await supabase
            .from('drive_items')
            .update({ 
              status: 'deleted', 
              trashed: true, 
              deleted_at: new Date().toISOString(),
              updated_at: new Date().toISOString() 
            })
            .eq('file_id', key)
            .eq('user_id', user.id);

          if (updateError) {
            console.error('❌ Error marking drive item as deleted:', updateError);
            return new Response(
              JSON.stringify({ error: 'Failed to mark drive item as deleted', details: updateError }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      } catch (tokenError) {
        console.error('❌ Error getting access token:', tokenError);
        return new Response(
          JSON.stringify({ error: 'Failed to authenticate with Google Drive' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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