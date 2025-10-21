// Minimal client com backoff e limits
export type BackoffOpts = { tries?: number; baseMs?: number; factor?: number };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function driveFetchJSON<T>(url: string, accessToken: string, init?: RequestInit, backoff: BackoffOpts = {}) {
  const tries = backoff.tries ?? 5;
  const base = backoff.baseMs ?? 400;
  const factor = backoff.factor ?? 1.8;

  let lastErr: any = null;
  for (let i = 0; i < tries; i++) {
    const r = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(init?.headers || {}),
      }
    });
    const body = await r.json().catch(() => ({}));
    if (r.ok) return body as T;

    // Quota/rate/5xx → backoff
    if ([429, 403, 500, 502, 503, 504].includes(r.status)) {
      lastErr = body;
      await sleep(Math.round(base * Math.pow(factor, i)));
      continue;
    }
    throw new Error(`DriveError ${r.status}: ${JSON.stringify(body)}`);
  }
  throw new Error(`DriveBackoffExceeded: ${JSON.stringify(lastErr)}`);
}

export type DriveFile = {
  id: string; 
  name: string; 
  mimeType: string; 
  parents?: string[]; 
  trashed?: boolean;
  md5Checksum?: string; 
  size?: string;
  createdTime?: string; 
  modifiedTime?: string;
  webViewLink?: string; 
  webContentLink?: string; 
  thumbnailLink?: string;
  imageMediaMetadata?: any; 
  videoMediaMetadata?: any; 
  driveId?: string;
};

export async function listChildren(folderId: string, accessToken: string, pageToken?: string) {
  const base = "https://www.googleapis.com/drive/v3/files";
  const q = `'${folderId}' in parents and trashed=false`;
  const fields = encodeURIComponent([
    "nextPageToken",
    "files(id,name,mimeType,parents,trashed,md5Checksum,size,createdTime,modifiedTime,webViewLink,webContentLink,thumbnailLink,imageMediaMetadata,videoMediaMetadata,driveId)"
  ].join(","));
  const url = `${base}?q=${encodeURIComponent(q)}&fields=${fields}&pageSize=500&supportsAllDrives=true&includeItemsFromAllDrives=true${pageToken ? `&pageToken=${pageToken}` : ""}`;
  return driveFetchJSON<{ files: DriveFile[]; nextPageToken?: string }>(url, accessToken);
}

export async function getStartPageToken(accessToken: string) {
  const url = "https://www.googleapis.com/drive/v3/changes/startPageToken?supportsAllDrives=true";
  return driveFetchJSON<{ startPageToken: string }>(url, accessToken);
}

export async function listChanges(pageToken: string, accessToken: string) {
  const fields = encodeURIComponent([
    "newStartPageToken,nextPageToken",
    "changes(fileId,removed,file(id,name,mimeType,parents,trashed,md5Checksum,size,createdTime,modifiedTime,webViewLink,webContentLink,thumbnailLink,imageMediaMetadata,videoMediaMetadata,driveId))"
  ].join(","));
  const url = `https://www.googleapis.com/drive/v3/changes?pageToken=${pageToken}&fields=${fields}&pageSize=500&supportsAllDrives=true&includeItemsFromAllDrives=true`;
  return driveFetchJSON<{ changes: any[]; nextPageToken?: string; newStartPageToken?: string }>(url, accessToken);
}

/**
 * Get drive client with access token for a user
 */
export async function getDriveClient(userId: string, supabase: any): Promise<{ token: string } | null> {
  // First try to get tokens from the secured table
  const { data: tokens, error } = await supabase
    .from('user_drive_tokens')
    .select('access_token_enc, refresh_token_enc, expires_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !tokens) {
    console.error('Failed to get user tokens:', error);
    return null;
  }

  // Check if token is expired
  const now = new Date();
  const expiresAt = new Date(tokens.expires_at);
  
  if (now >= expiresAt) {
    console.error('Access token expired for user:', userId);
    return null;
  }

  // For now, assume tokens are decrypted (they should be encrypted in production)
  return {
    token: tokens.access_token_enc
  };
}