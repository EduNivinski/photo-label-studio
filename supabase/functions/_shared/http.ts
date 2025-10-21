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
 * Returns a JSON response with proper headers and BigInt-safe serialization
 */
// Standard CORS headers for all functions
export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "https://photo-label-studio.lovable.app",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, cache-control, x-client-info, apikey, x-supabase-authorization, x-requested-with",
  "Access-Control-Max-Age": "86400",
};

export function json(status: number, body: unknown, extra: Record<string,string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      ...corsHeaders,
      ...extra,
    },
  });
}

export function httpJson(status: number, data: unknown, origin?: string | null): Response {
  // Get allowed origins from environment or use defaults
  const allowedOriginsEnv = Deno.env.get("CORS_ALLOWED_ORIGINS");
  const allowedOrigins = allowedOriginsEnv 
    ? allowedOriginsEnv.split(",").map(o => o.trim())
    : ["https://photo-label-studio.lovable.app", "http://localhost:3000", "http://localhost:5173"];
  
  const allowedOrigin = origin && allowedOrigins.includes(origin)
    ? origin 
    : allowedOrigins[0];

  // BigInt-safe JSON serialization
  const body = JSON.stringify(data, (_key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  );

  return new Response(body, {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Headers": "authorization, apikey, content-type, cache-control, x-client-info, x-supabase-authorization",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
    },
  });
}

/**
 * Returns a 204 No Content response with CORS headers for OPTIONS
 */
export function httpNoContent(origin?: string | null): Response {
  const allowedOriginsEnv = Deno.env.get("CORS_ALLOWED_ORIGINS");
  const allowedOrigins = allowedOriginsEnv 
    ? allowedOriginsEnv.split(",").map(o => o.trim())
    : ["https://photo-label-studio.lovable.app", "http://localhost:3000", "http://localhost:5173"];
  
  const allowedOrigin = origin && allowedOrigins.includes(origin)
    ? origin 
    : allowedOrigins[0];

  return new Response(null, {
    status: 204,
    headers: {
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Headers": "authorization, apikey, content-type, cache-control, x-client-info, x-supabase-authorization",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
    },
  });
}

/**
 * Safe error handling - logs details but returns generic message with code hint
 */
export function safeError(
  error: any,
  options: { publicMessage?: string; logContext?: string; hint?: string } = {}
): Response {
  const publicMessage = options.publicMessage || "Unable to process request.";
  const logContext = options.logContext || "ERROR";

  // Log full error details server-side only
  console.error(`[${logContext}]`, {
    message: error?.message || String(error),
    stack: error?.stack,
    timestamp: new Date().toISOString(),
  });

  // Return generic error to client with optional hint
  return httpJson(500, { 
    ok: false, 
    error: publicMessage,
    hint: options.hint 
  });
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
