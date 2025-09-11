import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { ensureAccessToken } from "../_shared/token_provider_v2.ts";
import { preflight, jsonCors } from "../_shared/cors.ts";

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
  console.log("diag-list-folder called");

  // CORS preflight
  const pf = preflight(req);
  if (pf) return pf;

  try {
    const auth = req.headers.get("authorization");
    const userId = getUserIdFromAuth(auth);
    
    if (!userId) {
      return jsonCors(req, 401, { reason: "NO_JWT" });
    }

    console.log("User authenticated:", userId);

    // Get folder ID from query params or body
    const url = new URL(req.url);
    const folderId = url.searchParams.get("folderId") || "root";
    console.log("Listing folder:", folderId);

    // Get access token with auto-refresh
    let accessToken;
    try {
      accessToken = await ensureAccessToken(userId);
      console.log("Token obtained, length:", accessToken.length);
    } catch (error) {
      console.error("Token error:", error);
      return jsonCors(req, 400, { reason: "NO_ACCESS_TOKEN", message: error.message });
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
        const freshToken = await ensureAccessToken(userId);
        const retryResp = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
          headers: { Authorization: `Bearer ${freshToken}` }
        });
        
        if (!retryResp.ok) {
          return jsonCors(req, retryResp.status, { 
            status: retryResp.status, 
            reason: "UNAUTHORIZED_AFTER_REFRESH" 
          });
        }
        
        const retryData = await retryResp.json();
        return jsonCors(req, 200, {
          status: "OK",
          folderId: folderId,
          items: retryData.files || [],
          echo: { corpora: "user" },
          retried: true
        });
      } catch (refreshError) {
        return jsonCors(req, 401, { error: "REFRESH_FAILED", message: refreshError.message });
      }
    }

    if (!resp.ok) {
      const errorText = await resp.text();
      console.error("API error:", errorText);
      return jsonCors(req, resp.status, { status: resp.status, reason: errorText });
    }

    const data = await resp.json();
    return jsonCors(req, 200, {
      status: "OK",
      folderId: folderId,
      items: data.files || [],
      echo: { corpora: "user" }
    });

  } catch (error: any) {
    console.error("Error in diag-list-folder:", error);
    return jsonCors(req, 500, { error: "INTERNAL_ERROR", message: error.message });
  }
});