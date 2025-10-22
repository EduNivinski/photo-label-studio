import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://photo-label-studio.lovable.app',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, cache-control, x-client-info, apikey',
  'Access-Control-Max-Age': '86400',
  'Cache-Control': 'no-store',
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  console.log('[health] Request received', { 
    method: req.method, 
    timestamp: new Date().toISOString() 
  });

  return new Response(
    JSON.stringify({ 
      ok: true, 
      status: "healthy",
      timestamp: new Date().toISOString(),
      service: "photo-label-studio-edge-functions"
    }), 
    {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      }
    }
  );
});
