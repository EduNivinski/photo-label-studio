import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { signPayload } from "../_shared/signing.ts";

function getAdmin() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

async function getUserIdFromReq(req: Request) {
  const auth = req.headers.get("authorization")||"";
  const jwt = auth.startsWith("Bearer ")? auth.slice(7):"";
  const admin = getAdmin();
  const { data } = await admin.auth.getUser(jwt);
  if (!data?.user?.id) throw new Error("INVALID_JWT");
  return data.user.id;
}

serve(async (req) => {
  try {
    if (req.method === "OPTIONS")
      return new Response(null, { status:204, headers: {
        "Access-Control-Allow-Origin":"https://photo-label-studio.lovable.app",
        "Access-Control-Allow-Headers":"authorization, content-type, apikey, x-client-info",
        "Access-Control-Allow-Methods":"POST, OPTIONS"
      }});
    
    const { fileIds } = await req.json();
    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return new Response(JSON.stringify({ ok:false, reason:"NO_FILEIDS" }), { 
        status:400,
        headers: {
          "Access-Control-Allow-Origin":"https://photo-label-studio.lovable.app",
          "Content-Type":"application/json"
        }
      });
    }
    
    const uid = await getUserIdFromReq(req);

    const base = Deno.env.get("SUPABASE_URL")!.replace(/\/$/,"");
    const exp = Date.now() + 5 * 60 * 1000; // 5 min
    const out: Record<string,string> = {};
    
    for (const id of fileIds) {
      const sig = await signPayload({ uid, fileId:id, exp });
      out[id] = `${base}/functions/v1/drive-thumb-signed?sig=${encodeURIComponent(sig)}`;
    }
    
    return new Response(JSON.stringify({ ok:true, urls: out }), { 
      status:200, 
      headers:{ 
        "Access-Control-Allow-Origin":"https://photo-label-studio.lovable.app", 
        "Content-Type":"application/json" 
      }
    });
  } catch (e:any) {
    return new Response(JSON.stringify({ ok:false, reason:"SIGN_ERR", message:e?.message||String(e) }), { 
      status:e?.message==="INVALID_JWT"?401:500, 
      headers:{ 
        "Access-Control-Allow-Origin":"https://photo-label-studio.lovable.app",
        "Content-Type":"application/json"
      }
    });
  }
});