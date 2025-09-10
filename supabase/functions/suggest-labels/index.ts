import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { HfInference } from 'https://esm.sh/@huggingface/inference@2.3.2'

// Updated CORS helper
const ALLOW_ORIGINS = new Set([
  "https://photo-label-studio.lovable.app",
  "https://a4888df3-b048-425b-8000-021ee0970cd7.sandbox.lovable.dev",
  "http://localhost:3000",
  "http://localhost:5173",
]);

function cors(origin: string | null) {
  const allowed = origin && ALLOW_ORIGINS.has(origin) ? origin : "https://photo-label-studio.lovable.app";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, x-supabase-authorization",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Vary": "Origin",
  };
}

// Mock data fallback when API is not available
const mockSuggestions = [
  'paisagem', 'natureza', 'céu', 'árvores', 'flores', 'pessoas', 
  'animais', 'arquitetura', 'comida', 'veículo', 'interior', 'exterior',
  'retrato', 'grupo', 'evento', 'trabalho', 'família', 'viagem'
];

function getRandomMockSuggestions(): string[] {
  const shuffled = [...mockSuggestions].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.floor(Math.random() * 4) + 2); // 2-5 suggestions
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors(req.headers.get("origin")) })
  }

  try {
    const { imageUrl } = await req.json()

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: 'Image URL is required' }),
        { headers: { ...cors(req.headers.get("origin")), 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const hfToken = Deno.env.get('HUGGING_FACE_ACCESS_TOKEN')
    
    // If no HuggingFace token, return mock data
    if (!hfToken) {
      console.log('No HuggingFace token found, using mock data')
      return new Response(
        JSON.stringify({ 
          suggestions: getRandomMockSuggestions(),
          source: 'mock'
        }),
        { headers: { ...cors(req.headers.get("origin")), 'Content-Type': 'application/json' } }
      )
    }

    try {
      const hf = new HfInference(hfToken)

      // Use image classification to identify objects/scenes
      const result = await hf.imageClassification({
        data: await fetch(imageUrl).then(r => r.blob()),
        model: 'google/vit-base-patch16-224'
      })

      // Process and translate results to Portuguese labels
      const suggestions = result
        .slice(0, 5) // Top 5 predictions
        .filter(item => item.score > 0.1) // Only confident predictions
        .map(item => {
          // Simple translation map for common labels
          const translations: { [key: string]: string } = {
            'person': 'pessoa',
            'people': 'pessoas',
            'car': 'carro',
            'dog': 'cachorro',
            'cat': 'gato',
            'house': 'casa',
            'building': 'prédio',
            'tree': 'árvore',
            'flower': 'flor',
            'food': 'comida',
            'animal': 'animal',
            'nature': 'natureza',
            'landscape': 'paisagem',
            'sky': 'céu',
            'water': 'água',
            'street': 'rua',
            'indoor': 'interior',
            'outdoor': 'exterior'
          }

          // Try to find translation or use original label
          const label = item.label.toLowerCase()
          return translations[label] || label.replace(/_/g, ' ')
        })

      return new Response(
        JSON.stringify({ 
          suggestions: suggestions.length > 0 ? suggestions : getRandomMockSuggestions(),
          source: suggestions.length > 0 ? 'ai' : 'mock'
        }),
        { headers: { ...cors(req.headers.get("origin")), 'Content-Type': 'application/json' } }
      )

    } catch (aiError) {
      console.error('AI analysis failed, using mock data:', aiError)
      
      // Fallback to mock data if AI fails
      return new Response(
        JSON.stringify({ 
          suggestions: getRandomMockSuggestions(),
          source: 'mock'
        }),
        { headers: { ...cors(req.headers.get("origin")), 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error('Error in suggest-labels function:', error)
    
    // Always provide mock data on error
    return new Response(
      JSON.stringify({ 
        suggestions: getRandomMockSuggestions(),
        source: 'mock',
        error: 'Fallback to mock data'
      }),
      { headers: { ...cors(req.headers.get("origin")), 'Content-Type': 'application/json' } }
    )
  }
})