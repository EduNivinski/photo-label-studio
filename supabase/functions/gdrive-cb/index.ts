import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async (req) => {
  // Return 410 Gone for legacy route
  const htmlResponse = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Route Deprecated</title>
      <meta charset="utf-8">
    </head>
    <body>
      <h1>Route Deprecated</h1>
      <p>This route has been deprecated. Please use the updated authentication flow.</p>
      <p>The new callback endpoint is: <code>/functions/v1/google-drive-auth/callback</code></p>
    </body>
    </html>
  `;

  return new Response(htmlResponse, {
    status: 410,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Access-Control-Allow-Origin": "https://photo-label-studio.lovable.app",
      "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
    }
  });
});