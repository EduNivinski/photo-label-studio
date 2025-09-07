import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ensureAccessToken } from "../_shared/token_provider.ts";

// Utility functions
const json = (s: number, b: unknown) => new Response(JSON.stringify(b), {
  status: s, 
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type, x-user-id",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
  }
});

serve(async (req) => {
  console.log("diag-list-folder called");

  if (req.method === "OPTIONS") {
    return json(200, {});
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return json(401, { error: "MISSING_AUTH" });
    }

    const jwt = authHeader.replace("Bearer ", "");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !user) {
      console.error("Auth error:", userError);
      return json(401, { error: "INVALID_JWT", details: userError });
    }

    console.log("User authenticated:", user.id);

    // Get folder ID from query params or body
    const url = new URL(req.url);
    const folderId = url.searchParams.get("folderId") || "root";
    console.log("Listing folder:", folderId);

    // Get access token with auto-refresh
    let accessToken;
    try {
      accessToken = await ensureAccessToken(user.id);
      console.log("Token obtained, length:", accessToken.length);
    } catch (error) {
      console.error("Token error:", error);
      return json(401, { error: "NO_TOKENS", message: error.message });
    }

    // Build query for folder contents
    const query = folderId === "root" 
      ? "mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false"
      : `'${folderId}' in parents and trashed=false`;

    const params = new URLSearchParams({
      q: query,
      fields: "nextPageToken,files(id,name,mimeType,parents,modifiedTime,shortcutDetails)",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
      corpora: "user",
      pageSize: "100",
    });

    console.log("API URL:", `https://www.googleapis.com/drive/v3/files?${params.toString()}`);

    const resp = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    console.log("Response status:", resp.status);

    if (resp.status === 401) {
      // Force refresh and retry once
      console.log("401 - attempting refresh and retry...");
      try {
        const freshToken = await ensureAccessToken(user.id);
        const retryResp = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
          headers: { Authorization: `Bearer ${freshToken}` }
        });
        
        if (!retryResp.ok) {
          return json(retryResp.status, { 
            status: retryResp.status, 
            reason: "UNAUTHORIZED_AFTER_REFRESH" 
          });
        }
        
        const retryData = await retryResp.json();
        return json(200, {
          status: "OK",
          folderId: folderId,
          items: retryData.files || [],
          echo: { corpora: "user" },
          retried: true
        });
      } catch (refreshError) {
        return json(401, { error: "REFRESH_FAILED", message: refreshError.message });
      }
    }

    if (!resp.ok) {
      const errorText = await resp.text();
      console.error("API error:", errorText);
      return json(resp.status, { status: resp.status, reason: errorText });
    }

    const data = await resp.json();
    return json(200, {
      status: "OK",
      folderId: folderId,
      items: data.files || [],
      echo: { corpora: "user" }
    });

  } catch (error: any) {
    console.error("Error in diag-list-folder:", error);
    return json(500, { error: "INTERNAL_ERROR", message: error.message });
  }
});