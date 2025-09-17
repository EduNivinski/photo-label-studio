import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(() => {
  return new Response(JSON.stringify({ 
    ok: true, 
    function: "hello-open",
    timestamp: new Date().toISOString()
  }), {
    status: 200,
    headers: { 
      "Content-Type": "application/json", 
      "Access-Control-Allow-Origin": "https://photo-label-studio.lovable.app" 
    }
  });
});