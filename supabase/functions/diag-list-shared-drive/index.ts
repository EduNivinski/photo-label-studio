import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { ensureAccessToken } from "../_shared/token_provider_v2.ts";

// Updated CORS helper
const ALLOW_ORIGINS = new Set([
  "https://photo-label-studio.lovable.app",
  "https://a4888df3-b048-425b-8000-021ee0970cd7.sandbox.lovable.dev",
  "http://localhost:3000",
  "http://localhost:5173",
]);

function cors(origin: string | null) {
  const allowed = origin && ALLOW_ORIGINS.has(origin) ? origin : "https://photo-label-studio.lovable.app";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, x-supabase-authorization",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Vary": "Origin",
  };
}

function getUserIdFromAuth(auth: string | null) {
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const token = auth.split(" ")[1];
    const [, payload] = token.split(".");
    return JSON.parse(atob(payload)).sub as string;
  } catch {
    return null;
  }
}

serve(async (req) => {
  console.log("diag-list-shared-drive called");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors(req.headers.get("origin")) });
  }

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", ...cors(req.headers.get("origin")) },
    });

  try {
    const auth = req.headers.get("authorization");
    const userId = getUserIdFromAuth(auth);
    
    if (!userId) {
      return json(401, { reason: "NO_JWT" });
    }

    console.log("User authenticated:", userId);

    // Get shared drive ID from query params
    const url = new URL(req.url);
    const driveId = url.searchParams.get("driveId");
    
    if (!driveId) {
      return json(400, { error: "MISSING_DRIVE_ID" });
    }

    console.log("Listing shared drive:", driveId);

    // Get access token with auto-refresh
    let accessToken;
    try {
      accessToken = await ensureAccessToken(userId);
      console.log("Token obtained, length:", accessToken.length);
    } catch (error) {
      console.error("Token error:", error);
      return json(400, { reason: "NO_ACCESS_TOKEN", message: error.message });
    }

    // Build query for shared drive contents
    const params = new URLSearchParams({
      q: "trashed=false",
      fields: "nextPageToken,files(id,name,mimeType,parents,modifiedTime,shortcutDetails)",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
      corpora: "drive",
      driveId: driveId,
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
        const freshToken = await ensureAccessToken(userId);
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
          driveId: driveId,
          items: retryData.files || [],
          echo: { corpora: "drive", driveId: driveId },
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
      driveId: driveId,
      items: data.files || [],
      echo: { corpora: "drive", driveId: driveId }
    });

  } catch (error: any) {
    console.error("Error in diag-list-shared-drive:", error);
    return json(500, { error: "INTERNAL_ERROR", message: error.message });
  }
});