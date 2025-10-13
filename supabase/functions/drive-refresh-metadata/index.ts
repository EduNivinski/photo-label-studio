import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth, httpJson, safeError } from "../_shared/http.ts";
import { checkRateLimit, RATE_LIMITS } from "../_shared/rate-limit.ts";
import { ensureAccessToken } from "../_shared/token_provider_v2.ts";

const SingleSchema = z.object({
  fileId: z.string().min(3),
  driveItemId: z.string().optional(),
  force: z.boolean().optional(),
});

const BatchSchema = z.object({
  fileIds: z.array(z.string().min(3)).min(1).max(100),
  force: z.boolean().optional(),
});

type GoogleMetadata = {
  ok: boolean;
  kind?: "photo" | "video";
  takenAt?: string | null;
  name?: string | null;
  status?: number;
};

async function getMeta(accessToken: string, fileId: string): Promise<GoogleMetadata> {
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`);
  url.searchParams.set("fields", "id,mimeType,name,imageMediaMetadata(time),videoMediaMetadata(time)");
  
  try {
    const r = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!r.ok) return { ok: false, status: r.status };
    
    const json = await r.json();
    const mime = json.mimeType as string | undefined;
    const imgTime = json?.imageMediaMetadata?.time as string | undefined;
    const vidTime = json?.videoMediaMetadata?.time as string | undefined;
    
    const kind = mime?.startsWith("video/") || vidTime ? "video"
                 : mime?.startsWith("image/") || imgTime ? "photo"
                 : undefined;

    const timeStr = imgTime ?? vidTime ?? undefined;
    let takenAt: string | null = null;
    if (timeStr) {
      const d = new Date(timeStr);
      if (!isNaN(d.getTime())) takenAt = d.toISOString();
    }
    
    return { ok: true, kind, takenAt, name: json?.name ?? null };
  } catch (e: any) {
    console.error(`[drive-refresh-metadata] Error fetching metadata for ${fileId}:`, e);
    return { ok: false };
  }
}

function getAdmin() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("ENV_MISSING_SUPABASE");
  return createClient(url, key);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type" } });
  }

  try {
    if (req.method !== "POST") throw new Error("METHOD_NOT_ALLOWED");
    
    const { user } = await requireAuth(req);
    await checkRateLimit({ req, user, endpoint: "drive-refresh-metadata", ...RATE_LIMITS.MEDIUM });

    const payload = await req.json().catch(() => ({}));
    const isBatch = "fileIds" in payload;
    const input = isBatch ? BatchSchema.parse(payload) : SingleSchema.parse(payload);

    const admin = getAdmin();

    // Get user's access token
    const { data: tok, error: tokErr } = await admin
      .from("user_drive_tokens")
      .select("access_token_enc")
      .eq("user_id", user.id)
      .maybeSingle();
    
    if (tokErr || !tok?.access_token_enc) {
      console.error("[drive-refresh-metadata] No token found for user:", user.id);
      throw new Error("DRIVE_NOT_CONNECTED");
    }

    // Use ensureAccessToken to get a valid token
    let accessToken: string;
    try {
      accessToken = await ensureAccessToken(user.id);
    } catch (e: any) {
      console.error("[drive-refresh-metadata] Token refresh failed:", e);
      throw new Error("TOKEN_REFRESH_FAILED");
    }

    const fileIds = isBatch ? input.fileIds : [input.fileId];
    let updated = 0;

    for (const fid of fileIds) {
      const meta = await getMeta(accessToken, fid);
      if (!meta.ok) {
        console.warn(`[drive-refresh-metadata] Failed to fetch metadata for ${fid}, status:`, meta.status);
        continue;
      }

      const updates: Record<string, unknown> = {};
      if (meta.kind) updates.media_kind = meta.kind;
      if (meta.takenAt) updates.original_taken_at = meta.takenAt;

      if (Object.keys(updates).length) {
        const { error: upErr } = await admin
          .from("drive_items")
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq("user_id", user.id)
          .eq("file_id", fid);
        
        if (upErr) {
          console.error(`[drive-refresh-metadata] DB update failed for ${fid}:`, upErr);
        } else {
          updated++;
          console.log(`[drive-refresh-metadata] Updated metadata for ${fid}:`, updates);
        }
      }
    }

    console.log(`[drive-refresh-metadata] Successfully updated ${updated} of ${fileIds.length} items for user ${user.id}`);
    return httpJson(200, { ok: true, updated });
    
  } catch (err) {
    console.error("[drive-refresh-metadata] Error:", err);
    return safeError(err, { publicMessage: "Falha ao atualizar metadados." });
  }
});
