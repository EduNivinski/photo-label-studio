import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface RateLimitConfig {
  userId: string;
  ip: string;
  endpoint: string;
  limit: number;
  windowSec: number;
}

/**
 * Check if request is within rate limit using server-side DB check
 */
export async function checkRateLimit(config: RateLimitConfig): Promise<boolean> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data, error } = await supabase.rpc("can_call", {
      p_user_id: config.userId,
      p_ip: config.ip,
      p_endpoint: config.endpoint,
      p_limit: config.limit,
      p_window_sec: config.windowSec,
    });

    if (error) {
      console.error("Rate limit check error:", error);
      // Fail open on error to avoid blocking legitimate requests
      return true;
    }

    return data === true;
  } catch (err) {
    console.error("Rate limit exception:", err);
    // Fail open on exception
    return true;
  }
}

/**
 * Rate limit configurations for different endpoints
 */
export const RATE_LIMITS = {
  "thumb-open": { limit: 60, windowSec: 60 }, // 60 req/min
  "library-list-unified": { limit: 120, windowSec: 300 }, // 120 req/5min
  "labels-apply-batch": { limit: 60, windowSec: 300 }, // 60 req/5min
  "google-drive-auth": { limit: 10, windowSec: 3600 }, // 10 req/hour
  "get-thumb-urls": { limit: 120, windowSec: 300 }, // 120 req/5min
} as const;
