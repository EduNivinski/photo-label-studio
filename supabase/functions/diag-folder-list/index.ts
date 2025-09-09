import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ensureAccessToken } from "../_shared/token_provider_v2.ts";

// CORS helper — aceitar sandbox do Lovable + localhost
function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  let allowOrigin = "";

  try {
    const u = new URL(origin);
    const isLovableRoot     = u.origin === "https://lovable.dev";
    const isLovableSandbox  = u.hostname.endsWith(".sandbox.lovable.dev");
    const isLocal3000       = u.origin === "http://localhost:3000";
    const isLocal5173       = u.origin === "http://localhost:5173";

    if (isLovableRoot || isLovableSandbox || isLocal3000 || isLocal5173) {
      allowOrigin = origin; // ecoa exatamente o origin da página
    }
  } catch { /* ignore */ }

  // Ecoa os headers solicitados no preflight (robusto)
  const reqHeaders = req.headers.get("access-control-request-headers");
  const allowHeaders = (reqHeaders && reqHeaders.trim().length > 0)
    ? reqHeaders
    : "authorization, content-type, apikey, x-client-info";

  return {
    "Access-Control-Allow-Origin": allowOrigin || "https://lovable.dev",
    "Access-Control-Allow-Headers": allowHeaders,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Vary": "Origin, Access-Control-Request-Headers",
  };
}

function json(s: number, b: unknown, req: Request) {
  return new Response(JSON.stringify(b), { 
    status: s, 
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' }
  });
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  try {
    console.log("🔍 Testing folder listing - simplified version...");

    // Use service role client to bypass JWT issues
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get request body to get user_id directly
    const body = await req.json();
    const userId = body.user_id;
    
    if (!userId) {
      return json(400, { error: 'USER_ID_REQUIRED' }, req);
    }

    console.log(`🔍 Testing for user: ${userId}`);

    // Test token access
    let accessToken;
    try {
      accessToken = await ensureAccessToken(userId);
      console.log("✅ Access token obtained successfully");
    } catch (tokenError) {
      console.error("❌ Token error:", tokenError);
      return json(500, { 
        error: 'TOKEN_ERROR', 
        message: tokenError instanceof Error ? tokenError.message : String(tokenError)
      }, req);
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
        }, req);
      }

      const driveData = await response.json();
      console.log(`✅ Drive API success. Found ${driveData.files?.length || 0} folders`);

      return json(200, {
        success: true,
        user_id: userId,
        folders_found: driveData.files?.length || 0,
        folders: driveData.files?.map((f: any) => ({
          id: f.id,
          name: f.name,
          parents: f.parents
        })) || [],
        raw_response: driveData
      }, req);

    } catch (fetchError) {
      console.error("❌ Fetch error:", fetchError);
      return json(500, { 
        error: 'FETCH_ERROR', 
        message: fetchError instanceof Error ? fetchError.message : String(fetchError)
      }, req);
    }

  } catch (error: any) {
    console.error('General error:', error);
    return json(500, { 
      error: "GENERAL_ERROR", 
      message: error.message,
      stack: error.stack
    }, req);
  }
});