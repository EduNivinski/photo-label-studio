import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

// Import security utilities
import { requireAuth, httpJson, safeError, getClientIp } from "../_shared/http.ts";
import { checkRateLimit, RATE_LIMITS } from "../_shared/rate-limit.ts";
import { signPayload } from "../_shared/signing.ts";

// Input validation schema
const GetVideoUrlsSchema = z.object({
  fileIds: z.array(z.string().min(1).max(256)).min(1).max(100),
});

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return httpJson(204, null);
  }

  try {
    // 1) Authentication
    const { userId, user } = await requireAuth(req);

    // 2) Rate limiting (120 req/5min)
    const ip = getClientIp(req);
    await checkRateLimit({
      userId,
      ip,
      endpoint: "get-video-urls",
      limit: RATE_LIMITS["get-thumb-urls"].limit,
      windowSec: RATE_LIMITS["get-thumb-urls"].windowSec,
    });

    // 3) Input validation
    const body = await req.json().catch(() => {
      throw new Error("INVALID_JSON");
    });
    const { fileIds } = GetVideoUrlsSchema.parse(body);

    // 4) Verify ownership using admin client
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: items, error } = await admin
      .from('drive_items')
      .select('file_id, mime_type')
      .in('file_id', fileIds)
      .eq('user_id', userId)
      .eq('trashed', false);

    if (error) {
      console.error('[GET_VIDEO_URLS] DB error:', error.message);
      throw new Error('DB_ERROR');
    }

    // Only return URLs for items the user owns
    const ownedFileIds = new Set(items.map(item => item.file_id));
    const validFileIds = fileIds.filter(id => ownedFileIds.has(id));

    if (validFileIds.length === 0) {
      return httpJson(200, { ok: true, ttlSec: 3600, urls: {} });
    }

    // 5) Generate signed URLs (1 hour TTL)
    const ttlSec = 3600;
    const expiresAt = Date.now() + (ttlSec * 1000);
    const baseUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/thumb-open`;

    const urls: Record<string, string> = {};

    for (const fileId of validFileIds) {
      // Generate unique nonce for replay protection
      const nonce = crypto.randomUUID();
      
      const payload = {
        uid: userId,
        fileId,
        exp: expiresAt,
        nonce,
      };

      const signature = await signPayload(payload);
      urls[fileId] = `${baseUrl}?sig=${signature}`;
    }

    return httpJson(200, {
      ok: true,
      ttlSec,
      urls,
    });

  } catch (error: any) {
    // Handle specific errors
    if (error.message === 'UNAUTHORIZED') {
      return httpJson(401, { ok: false, error: 'Authentication required' });
    }
    if (error.message === 'RATE_LIMITED') {
      return httpJson(429, { ok: false, error: 'Too many requests' });
    }
    if (error.message === 'INVALID_JSON') {
      return httpJson(400, { ok: false, error: 'Invalid request body' });
    }
    if (error instanceof z.ZodError) {
      return httpJson(400, { 
        ok: false, 
        error: 'Invalid input: fileIds must be array of 1-100 strings' 
      });
    }

    // Generic error (don't leak details)
    return safeError(error, {
      publicMessage: 'Unable to fetch video URLs',
      logContext: '[GET_VIDEO_URLS]',
    });
  }
});
