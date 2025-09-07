import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('🚀 GOOGLE DRIVE API CALLED - SIMPLE VERSION');
  
  if (req.method === 'OPTIONS') {
    console.log('✅ OPTIONS request');
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.split('/').pop();
  console.log('📍 Path:', path);

  if (path === 'folders') {
    console.log('📂 Folders endpoint hit');
    
    // Return mock folders for now to test if function works
    const mockFolders = [
      { id: 'folder1', name: 'Documentos' },
      { id: 'folder2', name: 'Fotos' },
      { id: 'folder3', name: 'Backup' }
    ];
    
    console.log('✅ Returning mock folders');
    return new Response(JSON.stringify({ folders: mockFolders }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  console.log('❌ Unknown path');
  return new Response(JSON.stringify({ error: 'Not found' }), { 
    status: 404, 
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});