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
 * TEMPORARILY DISABLED: Rate limit infrastructure is not set up yet
 * TODO: Implement proper rate limiting with security.can_call function
 */
export async function checkRateLimit(config: RateLimitConfig): Promise<boolean> {
  // Temporarily bypass rate limiting until security.can_call function is implemented
  console.log("[RATE_LIMIT_BYPASS]", {
    endpoint: config.endpoint,
    userId: config.userId,
    ip: config.ip,
  });
  
  // Always allow requests for now
  return true;
  
  /* COMMENTED OUT - Enable when security.can_call is implemented
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  
  // Use service role client for security schema functions
  const admin = createClient(supabaseUrl, supabaseKey);

  try {
    // Call security.can_call with fully qualified schema name
    const { data, error } = await admin.rpc("security.can_call", {
      p_user_id: config.userId,
      p_ip: config.ip,
      p_endpoint: config.endpoint,
      p_limit: config.limit,
      p_window_sec: config.windowSec,
    });

    if (error) {
      console.error("[RATE_LIMIT_RPC_ERROR]", error);
      // FAIL CLOSED: If rate limit check fails, block the request
      throw new Error("RATE_LIMIT_UNAVAILABLE");
    }

    if (data === false) {
      throw new Error("RATE_LIMITED");
    }

    return true;
  } catch (err) {
    console.error("[RATE_LIMIT_EXCEPTION]", err);
    // Re-throw to fail closed
    throw err;
  }
  */
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
