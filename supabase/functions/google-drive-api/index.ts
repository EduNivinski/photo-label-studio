import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('🚀 Google Drive API function called');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('✅ Returning CORS headers for OPTIONS request');
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.split('/').pop();
  console.log('📍 Path extracted:', path);

  if (path === 'folders') {
    console.log('📂 Testing folders endpoint');
    return new Response(JSON.stringify({ 
      message: 'Folders endpoint working',
      folders: []
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  console.log('❌ Path not found:', path);
  return new Response(JSON.stringify({ error: 'Not found', path }), { 
    status: 404, 
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});