import { encode as b64u } from "https://deno.land/std@0.224.0/encoding/base64url.ts";

function hmac(input: Uint8Array, key: Uint8Array) {
  return crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
    .then(k => crypto.subtle.sign("HMAC", k, input))
    .then(buf => new Uint8Array(buf));
}

export async function signPayload(obj: Record<string, unknown>) {
  const RAW_KEY = Deno.env.get("THUMB_SIGNING_KEY");
  if (!RAW_KEY) throw new Error("ENV_MISSING_THUMB_SIGNING_KEY");
  
  const key = new TextEncoder().encode(RAW_KEY);
  const payload = new TextEncoder().encode(JSON.stringify(obj));
  const mac = await hmac(payload, key);
  return `${b64u(payload)}.${b64u(mac)}`;
}

export async function verifyPayload(sig: string) {
  const RAW_KEY = Deno.env.get("THUMB_SIGNING_KEY");
  if (!RAW_KEY) throw new Error("ENV_MISSING_THUMB_SIGNING_KEY");
  
  const [p, m] = sig.split(".");
  if (!p || !m) throw new Error("BAD_SIG");
  const payload = Uint8Array.from(atob(p.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
  const macRecv = Uint8Array.from(atob(m.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
  const key = new TextEncoder().encode(RAW_KEY);
  const mac = await hmac(payload, key);
  if (mac.length !== macRecv.length || !mac.every((b, i) => b === macRecv[i])) throw new Error("BAD_SIG");
  const obj = JSON.parse(new TextDecoder().decode(payload));
  if (!obj || typeof obj !== "object") throw new Error("BAD_PAYLOAD");
  if (obj.exp && Date.now() > obj.exp) throw new Error("EXPIRED");
  return obj as { uid: string; fileId: string; exp: number };
}