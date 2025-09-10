import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1';
import { upsertTokens, getTokens, refreshAccessToken, deleteTokens } from "../_shared/token_provider_v2.ts";

// CORS helper with dynamic origin support
const ALLOW_ORIGINS = new Set([
  "https://photo-label-studio.lovable.app",
  "https://a4888df3-b048-425b-8000-021ee0970cd7.sandbox.lovable.dev",
  "https://lovable.dev",
  "http://localhost:3000"
]);

function cors(origin: string | null) {
  const allowed = origin && ALLOW_ORIGINS.has(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allowed || "https://photo-label-studio.lovable.app",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Vary": "Origin"
  };
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const googleClientId = Deno.env.get('GOOGLE_DRIVE_CLIENT_ID')!;
const googleClientSecret = Deno.env.get('GOOGLE_DRIVE_CLIENT_SECRET')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function validateInput(input: string, maxLength: number = 255): boolean {
  if (!input || typeof input !== 'string') return false;
  if (input.length > maxLength) return false;
  
  // Check for suspicious patterns
  const dangerousPatterns = [
    /<script/i, /javascript:/i, /on\w+\s*=/i, /\0/,
    /union\s+select/i, /drop\s+table/i, /';--/i
  ];
  
  return !dangerousPatterns.some(pattern => pattern.test(input));
}

function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>\"'&]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/\0/g, '');
}
function validateInput(input: string, maxLength: number = 255): boolean {
  if (!input || typeof input !== 'string') return false;
  if (input.length > maxLength) return false;
  
  // Check for suspicious patterns
  const dangerousPatterns = [
    /<script/i, /javascript:/i, /on\w+\s*=/i, /\0/,
    /union\s+select/i, /drop\s+table/i, /';--/i
  ];
  
  return !dangerousPatterns.some(pattern => pattern.test(input));
}

function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>\"'&]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/\0/g, '');
}

async function logSecurityEvent(event: {
  event_type: string;
  user_id?: string;
  metadata: Record<string, any>;
}) {
  try {
    await supabase.from('security_events').insert({
      event_type: event.event_type,
      user_id: event.user_id,
      metadata: event.metadata
    });
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
}

function getUserIdFromAuth(auth: string | null) {
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const token = auth.split(" ")[1];
    const [, payload] = token.split(".");
    return JSON.parse(atob(payload)).sub as string;
  } catch {
    return null;
  }
}

function createSignedState(userId: string, nonce: string): string {
  // Simple signed state - in production you'd use HMAC
  const data = `${userId}:${nonce}:${Date.now()}`;
  return btoa(data);
}

function validateSignedState(state: string): { userId: string; valid: boolean } {
  try {
    const decoded = atob(state);
    const [userId, nonce, timestamp] = decoded.split(':');
    
    // Check if state is not older than 10 minutes
    const isValid = (Date.now() - parseInt(timestamp)) < 600000;
    
    return { userId, valid: isValid };
  } catch {
    return { userId: '', valid: false };
  }
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors(origin) });
  }

  const url = new URL(req.url);
  const path = url.pathname.split("/").slice(4).join("/");

  try {
    // Handle POST requests for authorization
    if (req.method === "POST") {
      return handlePostAuthorize(req, origin);
    }
    
    // Handle GET requests by path
    if (path === "callback") {
      return handleCallback(req, origin);
    } else if (path === "status") {
      return handleStatus(req, origin);
    } else if (path === "disconnect") {
      return handleDisconnect(req, origin);
    } else if (path === "refresh") {
      return handleRefresh(req, origin);
    } else if (path === "reset-integration") {
      return handleResetIntegration(req, origin);
    }

    return new Response(JSON.stringify({ ok: false, reason: "UNKNOWN_PATH", path }), {
      status: 404,
      headers: { "Content-Type": "application/json", ...cors(origin) }
    });
  } catch (error) {
    console.error('Error in google-drive-auth function:', error);
    
    return new Response(JSON.stringify({ 
      ok: false, 
      reason: "INTERNAL_ERROR", 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...cors(origin) }
    });
  }
});

async function handlePostAuthorize(req: Request, origin: string | null) {
  const authHeader = req.headers.get('Authorization');
  const userId = getUserIdFromAuth(authHeader);
  
  if (!userId) {
    return new Response(JSON.stringify({ reason: "NO_JWT" }), { 
      status: 401, 
      headers: { "Content-Type": "application/json", ...cors(origin) }
    });
  }

  try {
    const body = await req.json();
    
    if (body.action !== "authorize") {
      return new Response(JSON.stringify({ reason: "INVALID_ACTION" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...cors(origin) }
      });
    }

    const redirectUrl = body.redirect || `${origin}/google-drive`;
    const nonce = Math.random().toString(36).substring(2, 15);
    const signedState = createSignedState(userId, nonce);
    
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', googleClientId);
    authUrl.searchParams.set('redirect_uri', `${supabaseUrl}/functions/v1/google-drive-auth/callback`);
    authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/drive.metadata.readonly https://www.googleapis.com/auth/drive.file');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');
    authUrl.searchParams.set('include_granted_scopes', 'false');
    authUrl.searchParams.set('state', signedState);

    return new Response(JSON.stringify({ authorizeUrl: authUrl.toString() }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...cors(origin) }
    });
    
  } catch (error) {
    console.error('POST authorize error:', error);
    return new Response(JSON.stringify({
      ok: false,
      reason: "POST_AUTHORIZE_ERROR",
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...cors(origin) }
    });
  }
}

async function handleCallback(req: Request, origin: string | null) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const state = url.searchParams.get('state');

  console.log('Callback received - code:', !!code, 'error:', error, 'state:', state);

  if (error) {
    return new Response(`
      <!DOCTYPE html>
      <html>
      <head><title>Google Drive - Erro</title></head>
      <body>
        <h1>Erro de Autorização</h1>
        <p>OAuth Error: ${error}</p>
        <script>setTimeout(() => window.close(), 3000);</script>
      </body>
      </html>
    `, { 
      status: 400, 
      headers: { "Content-Type": "text/html", ...cors(origin) }
    });
  }

  if (!code || !state) {
    return new Response(`
      <!DOCTYPE html>
      <html>
      <head><title>Google Drive - Erro</title></head>
      <body>
        <h1>Parâmetros Inválidos</h1>
        <p>Código ou state não encontrados.</p>
        <script>setTimeout(() => window.close(), 3000);</script>
      </body>
      </html>
    `, { 
      status: 400, 
      headers: { "Content-Type": "text/html", ...cors(origin) }
    });
  }

  // Validate signed state
  const stateValidation = validateSignedState(state);
  if (!stateValidation.valid) {
    return new Response(`
      <!DOCTYPE html>
      <html>
      <head><title>Google Drive - Erro</title></head>
      <body>
        <h1>State Inválido</h1>
        <p>Token de segurança inválido ou expirado.</p>
        <script>setTimeout(() => window.close(), 3000);</script>
      </body>
      </html>
    `, { 
      status: 400, 
      headers: { "Content-Type": "text/html", ...cors(origin) }
    });
  }

  const userId = stateValidation.userId;

  // Exchange code for tokens
  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: googleClientId,
        client_secret: googleClientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${supabaseUrl}/functions/v1/google-drive-auth/callback`,
      }),
    });

    const tokens = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', tokens);
      return new Response(`
        <!DOCTYPE html>
        <html>
        <head><title>Google Drive - Erro</title></head>
        <body>
          <h1>Falha na Autenticação</h1>
          <p>Não foi possível trocar código por tokens.</p>
          <script>setTimeout(() => window.close(), 3000);</script>
        </body>
        </html>
      `, { 
        status: 400, 
        headers: { "Content-Type": "text/html", ...cors(origin) }
      });
    }

    console.log('Tokens received successfully');

    // Get user info from Google
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    const userInfo = await userResponse.json();
    console.log('User info retrieved:', userInfo.email);
    
    // Store tokens securely using the new encrypted system
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    const scopeString = tokens.scope || 'https://www.googleapis.com/auth/drive.readonly';
    await upsertTokens(userId, tokens.access_token, tokens.refresh_token, scopeString, expiresAt);
      
    console.log('Tokens stored successfully for user:', userId);
    
    const userEmail = userInfo?.email || 'unknown';

    // Return success HTML
    return new Response(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Google Drive Conectado</title>
      </head>
      <body>
        <div style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1 style="color: #4CAF50;">✓ Google Drive Conectado!</h1>
          <p>Sua conta <strong>${userEmail}</strong> foi conectada com sucesso.</p>
          <p><a href="/google-drive">Voltar para Google Drive</a></p>
        </div>
        <script>
          // Opcional: fechar janela se for popup
          if (window.opener) {
            window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS' }, '*');
            setTimeout(() => window.close(), 2000);
          } else {
            // Redirecionar se for mesma aba
            setTimeout(() => window.location.href = '/google-drive', 2000);
          }
        </script>
      </body>
      </html>
    `, {
      headers: { 
        'Content-Type': 'text/html; charset=utf-8',
        ...cors(origin)
      },
    });

  } catch (error) {
    console.error('Exception during token storage:', error);
    
    return new Response(`
      <!DOCTYPE html>
      <html>
      <head><title>Google Drive - Erro</title></head>
      <body>
        <h1>Erro Interno</h1>
        <p>Falha ao processar autenticação: ${error instanceof Error ? error.message : 'Unknown error'}</p>
        <script>setTimeout(() => window.close(), 3000);</script>
      </body>
      </html>
    `, {
      status: 500,
      headers: { "Content-Type": "text/html", ...cors(origin) }
    });
  }
}

async function handleRefresh(req: Request, origin: string | null) {
  const authHeader = req.headers.get('Authorization');
  const userId = getUserIdFromAuth(authHeader);
  
  if (!userId) {
    return new Response(JSON.stringify({ reason: "NO_JWT" }), { 
      status: 401, 
      headers: { "Content-Type": "application/json", ...cors(origin) }
    });
  }

  try {
    // Get current tokens from secure storage
    const tokenData = await getTokens(userId);
    
    if (!tokenData) {
      return new Response(JSON.stringify({ reason: "NO_ACCESS_TOKEN" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...cors(origin) }
      });
    }
    
    // Use our built-in refresh mechanism
    const newAccessToken = await refreshAccessToken(userId);
    
    return new Response(JSON.stringify({
      ok: true,
      message: 'Token refreshed successfully'
    }), {
      headers: { "Content-Type": "application/json", ...cors(origin) }
    });
    
  } catch (error) {
    console.error('Refresh error:', error);
    
    return new Response(JSON.stringify({
      ok: false,
      reason: "REFRESH_ERROR",
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...cors(origin) }
    });
  }
}

async function handleDisconnect(req: Request, origin: string | null) {
  const authHeader = req.headers.get('Authorization');
  const userId = getUserIdFromAuth(authHeader);
  
  if (!userId) {
    return new Response(JSON.stringify({ reason: "NO_JWT" }), { 
      status: 401, 
      headers: { "Content-Type": "application/json", ...cors(origin) }
    });
  }

  try {
    await deleteTokens(userId);
    console.log('✅ Tokens deleted successfully');

    console.log(`Successfully disconnected and cleaned up tokens for user: ${userId}`);

    return new Response(JSON.stringify({
      ok: true,
      message: 'Google Drive completely disconnected.'
    }), {
      headers: { "Content-Type": "application/json", ...cors(origin) }
    });
  } catch (error) {
    console.error('Disconnect error:', error);
    
    return new Response(JSON.stringify({
      ok: false,
      reason: "DISCONNECT_ERROR",
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...cors(origin) }
    });
  }
}

async function handleStatus(req: Request, origin: string | null) {
  const authHeader = req.headers.get('Authorization');
  const userId = getUserIdFromAuth(authHeader);
  
  if (!userId) {
    return new Response(JSON.stringify({ reason: "NO_JWT" }), { 
      status: 401, 
      headers: { "Content-Type": "application/json", ...cors(origin) }
    });
  }

  try {
    console.log('Checking connection status for user:', userId);
    
    const tokenData = await getTokens(userId);
    const hasConnection = !!tokenData;
    
    if (!hasConnection) {
      return new Response(JSON.stringify({
        hasConnection: false,
        isExpired: false,
        dedicatedFolderId: null,
        dedicatedFolderName: null
      }), {
        headers: { "Content-Type": "application/json", ...cors(origin) }
      });
    }
    
    const isExpired = new Date(tokenData.expires_at).getTime() < Date.now();

    return new Response(JSON.stringify({
      hasConnection,
      isExpired,
      dedicatedFolderId: null,
      dedicatedFolderName: null
    }), {
      headers: { "Content-Type": "application/json", ...cors(origin) }
    });
    
  } catch (error) {
    console.error('Exception during status check:', error);
    return new Response(JSON.stringify({
      ok: false,
      reason: "STATUS_ERROR",
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...cors(origin) }
    });
  }
}

async function handleResetIntegration(req: Request, origin: string | null) {
  const authHeader = req.headers.get('Authorization');
  const userId = getUserIdFromAuth(authHeader);
  
  if (!userId) {
    return new Response(JSON.stringify({ reason: "NO_JWT" }), { 
      status: 401, 
      headers: { "Content-Type": "application/json", ...cors(origin) }
    });
  }

  try {
    await deleteTokens(userId);
    console.log('Integration reset completed for user:', userId);

    return new Response(JSON.stringify({
      ok: true,
      message: 'Integration reset completed'
    }), {
      headers: { "Content-Type": "application/json", ...cors(origin) }
    });
  } catch (error) {
    console.error('Reset error:', error);
    
    return new Response(JSON.stringify({
      ok: false,
      reason: "RESET_ERROR", 
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...cors(origin) }
    });
  }
}