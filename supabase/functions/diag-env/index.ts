import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const json = (s: number, b: unknown) => new Response(JSON.stringify(b), {
  status: s,
  headers: {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "authorization,content-type,apikey,x-client-info",
    "access-control-allow-methods": "GET,POST,OPTIONS"
  }
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "authorization,content-type,apikey,x-client-info",
        "access-control-allow-methods": "GET,POST,OPTIONS"
      }
    });
  }

  const ok = (k: string) => !!Deno.env.get(k);
  
  return json(200, {
    GOOGLE_DRIVE_CLIENT_ID: ok("GOOGLE_DRIVE_CLIENT_ID"),
    GOOGLE_DRIVE_CLIENT_SECRET: ok("GOOGLE_DRIVE_CLIENT_SECRET"),
    GOOGLE_REDIRECT_URI: ok("GOOGLE_REDIRECT_URI"),
    TOKEN_ENC_KEY: ok("TOKEN_ENC_KEY"),
    CORS_ALLOWED_ORIGINS: ok("CORS_ALLOWED_ORIGINS"),
  });
});