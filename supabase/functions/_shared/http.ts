import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface AuthResult {
  userId: string;
  user: any;
}

/**
 * Requires JWT authentication and returns user info
 */
export async function requireAuth(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("UNAUTHORIZED");
  }

  const token = authHeader.replace("Bearer ", "");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    throw new Error("UNAUTHORIZED");
  }

  return { userId: user.id, user };
}

/**
 * Returns a JSON response with proper headers
 */
export function httpJson(status: number, data: unknown, origin?: string | null): Response {
  const allowedOrigin = origin && origin === "https://photo-label-studio.lovable.app" 
    ? origin 
    : "https://photo-label-studio.lovable.app";

  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    },
  });
}

/**
 * Safe error handling - logs details but returns generic message
 */
export function safeError(
  error: any,
  options: { publicMessage?: string; logContext?: string } = {}
): Response {
  const publicMessage = options.publicMessage || "Unable to process request.";
  const logContext = options.logContext || "ERROR";

  // Log full error details server-side only
  console.error(`[${logContext}]`, {
    message: error?.message || String(error),
    stack: error?.stack,
    timestamp: new Date().toISOString(),
  });

  // Return generic error to client
  return httpJson(500, { ok: false, error: publicMessage });
}

/**
 * Get client IP address from request
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}
