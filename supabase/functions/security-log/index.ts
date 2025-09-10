import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1';

const ALLOW_ORIGINS = new Set([
  "https://photo-label-studio.lovable.app",
  "https://a4888df3-b048-425b-8000-021ee0970cd7.sandbox.lovable.dev",
  "http://localhost:3000"
]);

function cors(origin: string | null) {
  const allowed = origin && ALLOW_ORIGINS.has(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allowed || "https://photo-label-studio.lovable.app",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Vary": "Origin"
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

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  const origin = req.headers.get("origin");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors(origin) });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ reason: "METHOD_NOT_ALLOWED" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...cors(origin) }
    });
  }

  const authHeader = req.headers.get('Authorization');
  const userId = getUserIdFromAuth(authHeader);
  
  if (!userId) {
    return new Response(JSON.stringify({ reason: "NO_JWT" }), { 
      status: 401, 
      headers: { "Content-Type": "application/json", ...cors(origin) }
    });
  }

  try {
    const body = await req.json();
    
    // Validate event structure
    if (!body.event_type || typeof body.event_type !== 'string') {
      return new Response(JSON.stringify({ reason: "INVALID_EVENT_TYPE" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...cors(origin) }
      });
    }

    // Only allow specific event types for security
    const allowedEventTypes = [
      'rate_limit_exceeded',
      'sensitive_operation',
      'auth_attempt',
      'file_upload'
    ];

    if (!allowedEventTypes.includes(body.event_type)) {
      return new Response(JSON.stringify({ reason: "FORBIDDEN_EVENT_TYPE" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...cors(origin) }
      });
    }

    // Insert security event with service role
    await supabase.from('security_events').insert({
      event_type: body.event_type,
      user_id: userId,
      metadata: {
        ...body.metadata,
        user_agent: req.headers.get('user-agent'),
        timestamp: new Date().toISOString(),
        origin: origin
      }
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json", ...cors(origin) }
    });

  } catch (error) {
    console.error('Security log error:', error);
    
    return new Response(JSON.stringify({
      ok: false,
      reason: "LOG_ERROR",
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...cors(origin) }
    });
  }
});