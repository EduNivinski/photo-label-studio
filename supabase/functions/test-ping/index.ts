import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

console.log("🚀 test-ping function started");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req: Request) => {
  console.log("📋 test-ping: Request received", req.method, req.url);
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    console.log("📋 test-ping: Handling OPTIONS preflight");
    return new Response(null, { 
      status: 204,
      headers: corsHeaders
    });
  }
  
  try {
    console.log("📋 test-ping: Processing main request");
    
    const response = {
      ok: true,
      function: "test-ping",
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      headers: Object.fromEntries(req.headers.entries())
    };
    
    console.log("📋 test-ping: Sending successful response");
    
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error("❌ test-ping: Error:", error);
    return new Response(JSON.stringify({ 
      ok: false, 
      error: "INTERNAL_ERROR",
      message: error.message 
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  }
});