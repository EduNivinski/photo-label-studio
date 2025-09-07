import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ensureAccessToken } from "../_shared/token_provider.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(s: number, b: unknown) {
  return new Response(JSON.stringify(b), { 
    status: s, 
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🔍 Testing folder listing after reconnection...");

    // Get user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json(401, { error: 'NO_AUTH' });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.error("Auth error:", authError);
      return json(401, { error: 'AUTH_FAILED', details: authError?.message });
    }

    console.log(`🔍 Testing for user: ${user.id}`);

    // Test token access
    let accessToken;
    try {
      accessToken = await ensureAccessToken(user.id);
      console.log("✅ Access token obtained successfully");
    } catch (tokenError) {
      console.error("❌ Token error:", tokenError);
      return json(500, { 
        error: 'TOKEN_ERROR', 
        message: tokenError instanceof Error ? tokenError.message : String(tokenError)
      });
    }

    // Test Google Drive API access
    console.log("🔍 Testing Google Drive API access...");
    
    const driveUrl = "https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.folder' and parents in 'root'&fields=files(id,name,parents)&pageSize=20";
    
    try {
      const response = await fetch(driveUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      console.log(`Drive API response status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Drive API error:", response.status, errorText);
        return json(500, { 
          error: 'DRIVE_API_ERROR', 
          status: response.status,
          message: errorText
        });
      }

      const driveData = await response.json();
      console.log(`✅ Drive API success. Found ${driveData.files?.length || 0} folders`);

      return json(200, {
        success: true,
        user_id: user.id,
        folders_found: driveData.files?.length || 0,
        folders: driveData.files?.map((f: any) => ({
          id: f.id,
          name: f.name,
          parents: f.parents
        })) || [],
        raw_response: driveData
      });

    } catch (fetchError) {
      console.error("❌ Fetch error:", fetchError);
      return json(500, { 
        error: 'FETCH_ERROR', 
        message: fetchError instanceof Error ? fetchError.message : String(fetchError)
      });
    }

  } catch (error: any) {
    console.error('General error:', error);
    return json(500, { 
      error: "GENERAL_ERROR", 
      message: error.message,
      stack: error.stack
    });
  }
});