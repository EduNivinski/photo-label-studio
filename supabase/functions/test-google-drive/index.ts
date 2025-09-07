import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('🚀 Test Google Drive function called');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  
  if (req.method === 'OPTIONS') {
    console.log('✅ OPTIONS request');
    return new Response(null, { headers: corsHeaders });
  }

  console.log('📂 Returning test folders response');
  return new Response(JSON.stringify({ 
    message: 'Test function working!',
    folders: [
      { id: 'test1', name: 'Pasta Teste 1' },
      { id: 'test2', name: 'Pasta Teste 2' }
    ]
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});