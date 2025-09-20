export async function preflightDriveCallback(): Promise<{ ok: boolean; reason?: string }> {
  try {
    const url = "https://tcupxcxyylxfgsbhfdhw.supabase.co/functions/v1/google-drive-oauth-callback2?code=TEST&state=TEST";
    const r = await fetch(url, { method: "GET" });
    
    // Aceitamos 200/400/500 desde que NÃO seja 401 do gateway
    if (r.status === 401) {
      const body = await r.text().catch(() => "");
      const isGateway = body.includes("Missing authorization header");
      if (isGateway) return { ok: false, reason: "GATEWAY_JWT_ON" };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, reason: e?.message || "NETWORK_ERR" };
  }
}