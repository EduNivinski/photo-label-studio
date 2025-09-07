import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

console.log("🚀 test-ping function started");

serve(async (req: Request) => {
  console.log("📋 test-ping: Request received", req.method, req.url);
  
  if (req.method === "OPTIONS") {
    console.log("📋 test-ping: OPTIONS request");
    return new Response(null, { 
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
      }
    });
  }
  
  try {
    console.log("📋 test-ping: Processing request");
    
    const response = {
      ok: true,
      function: "test-ping",
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url
    };
    
    console.log("📋 test-ping: Sending response", response);
    
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type"
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
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type"
      }
    });
  }
});