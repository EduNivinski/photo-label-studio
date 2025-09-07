import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.split('/').pop();

  try {
    if (path === 'folders') {
      return handleListFolders(req);
    } else if (path === 'files') {
      return handleListFiles(req);
    } else if (path === 'set-folder') {
      return handleSetDedicatedFolder(req);
    } else if (path === 'download') {
      return handleDownloadFile(req);
    } else if (path === 'upload') {
      return handleUploadFile(req);
    }

    return new Response('Not found', { 
      status: 404, 
      headers: corsHeaders 
    });
  } catch (error) {
    console.error('Error in google-drive-api function:', error);
    // Don't expose internal error details to clients
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Get access token for a user with detailed logging
async function getAccessToken(userId: string): Promise<string | null> {
  try {
    console.log('Getting access token for user:', userId);
    
    const { data: tokens, error } = await supabase.rpc('get_google_drive_tokens_secure', {
      p_user_id: userId
    });

    if (error) {
      console.error('Error getting tokens from RPC:', error);
      console.error('Token error details:', JSON.stringify(error, null, 2));
      return null;
    }

    if (!tokens || tokens.length === 0) {
      console.log('No tokens found for user:', userId);
      return null;
    }

    const tokenData = tokens[0];
    console.log('Token data retrieved, expires at:', tokenData.expires_at);
    console.log('Access token first 10 chars:', tokenData.access_token?.substring(0, 10));
    
    // Check if token is expired (with 5 minute buffer)
    const expiresAt = new Date(tokenData.expires_at);
    const now = new Date();
    const bufferTime = 5 * 60 * 1000; // 5 minutes

    if (expiresAt.getTime() - now.getTime() < bufferTime) {
      console.log('Token expired for user:', userId, 'expired at:', tokenData.expires_at, 'current time:', now.toISOString());
      return null;
    }

    console.log('Valid access token found for user:', userId);
    return tokenData.access_token;
    
  } catch (error) {
    console.error('Exception getting access token:', error);
    console.error('Exception details:', error.message, error.stack);
    return null;
  }
}

async function handleListFolders(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    console.error('No authorization header found');
    return new Response(JSON.stringify({ error: 'Unauthorized - no auth header' }), { 
      status: 401, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  
  if (userError || !user) {
    console.error('User authentication failed:', userError);
    return new Response(JSON.stringify({ error: 'Unauthorized - invalid user' }), { 
      status: 401, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  console.log('User authenticated successfully:', user.id);

  const accessToken = await getAccessToken(user.id);
  if (!accessToken) {
    console.error('No access token found for user:', user.id);
    return new Response(JSON.stringify({ error: 'Google Drive not connected or token expired' }), { 
      status: 401, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  console.log('Access token retrieved, making API call to Google Drive...');

  // List folders in Drive
  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.folder'&fields=files(id,name,parents)&pageSize=100`,
      {
        headers: { 
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        },
      }
    );

    console.log('Google Drive API response status:', response.status);
    
    const data = await response.json();

    if (!response.ok) {
      console.error('Google Drive API error:', data);
      return new Response(JSON.stringify({ error: 'Failed to fetch folders', details: data }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Successfully fetched folders from Google Drive:', data.files?.length || 0);
    
    return new Response(JSON.stringify({ folders: data.files || [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (fetchError) {
    console.error('Network error calling Google Drive API:', fetchError);
    return new Response(JSON.stringify({ error: 'Network error calling Google Drive API' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

async function handleSetDedicatedFolder(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  
  if (userError || !user) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders });
  }

  const { folderId, folderName } = await req.json();

  if (!folderId || !folderName) {
    return new Response('Folder ID and name are required', { 
      status: 400, headers: corsHeaders 
    });
  }

  // Update dedicated folder in database
  const { error } = await supabase
    .from('google_drive_tokens')
    .update({
      dedicated_folder_id: folderId,
      dedicated_folder_name: folderName,
    })
    .eq('user_id', user.id);

  if (error) {
    console.error('Failed to set dedicated folder:', error);
    return new Response('Failed to set dedicated folder', { 
      status: 500, headers: corsHeaders 
    });
  }

  return new Response(JSON.stringify({ 
    message: 'Dedicated folder set successfully',
    folder: { id: folderId, name: folderName }
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleListFiles(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  
  if (userError || !user) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders });
  }

  const accessToken = await getAccessToken(user.id);
  if (!accessToken) {
    return new Response('Google Drive not connected or token expired', { 
      status: 401, headers: corsHeaders 
    });
  }

  // Get dedicated folder
  const { data: tokenData, error: tokenError } = await supabase
    .from('google_drive_tokens')
    .select('dedicated_folder_id')
    .eq('user_id', user.id)
    .single();

  if (tokenError || !tokenData?.dedicated_folder_id) {
    return new Response('No dedicated folder set', { 
      status: 400, headers: corsHeaders 
    });
  }

  const url = new URL(req.url);
  const folderId = url.searchParams.get('folderId') || tokenData.dedicated_folder_id;

  // Query for images and videos in the dedicated folder and its subfolders
  const mimeTypeQuery = [
    "mimeType contains 'image/'",
    "mimeType contains 'video/'",
    "mimeType = 'application/vnd.google-apps.folder'"
  ].join(' or ');

  const query = `'${folderId}' in parents and (${mimeTypeQuery}) and trashed=false`;
  
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,size,createdTime,modifiedTime,thumbnailLink,webViewLink,parents)&pageSize=100`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    console.error('Google Drive API error:', data);
    return new Response(JSON.stringify({ error: 'Failed to fetch files' }), {
      status: response.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Separate folders and files
  const folders = data.files?.filter((file: any) => 
    file.mimeType === 'application/vnd.google-apps.folder'
  ) || [];
  
  const files = data.files?.filter((file: any) => 
    file.mimeType !== 'application/vnd.google-apps.folder'
  ) || [];

  return new Response(JSON.stringify({ 
    files: files.map((file: any) => ({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      size: file.size ? parseInt(file.size) : 0,
      createdTime: file.createdTime,
      modifiedTime: file.modifiedTime,
      thumbnailLink: file.thumbnailLink,
      webViewLink: file.webViewLink,
      mediaType: file.mimeType?.startsWith('image/') ? 'photo' : 'video',
    })),
    folders: folders.map((folder: any) => ({
      id: folder.id,
      name: folder.name,
    }))
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleDownloadFile(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  
  if (userError || !user) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders });
  }

  const accessToken = await getAccessToken(user.id);
  if (!accessToken) {
    return new Response('Google Drive not connected or token expired', { 
      status: 401, headers: corsHeaders 
    });
  }

  const url = new URL(req.url);
  const fileId = url.searchParams.get('fileId');

  if (!fileId) {
    return new Response('File ID is required', { 
      status: 400, headers: corsHeaders 
    });
  }

  // Download file from Google Drive
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    console.error('Failed to download file from Google Drive');
    return new Response('Failed to download file', { 
      status: response.status, headers: corsHeaders 
    });
  }

  // Return the file data
  const fileData = await response.arrayBuffer();
  
  return new Response(fileData, {
    headers: {
      ...corsHeaders,
      'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream',
      'Content-Length': fileData.byteLength.toString(),
    },
  });
}

async function handleUploadFile(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  
  if (userError || !user) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders });
  }

  const accessToken = await getAccessToken(user.id);
  if (!accessToken) {
    return new Response('Google Drive not connected or token expired', { 
      status: 401, headers: corsHeaders 
    });
  }

  // Get dedicated folder
  const { data: tokenData, error: tokenError } = await supabase
    .from('google_drive_tokens')
    .select('dedicated_folder_id')
    .eq('user_id', user.id)
    .single();

  if (tokenError || !tokenData?.dedicated_folder_id) {
    return new Response('No dedicated folder set', { 
      status: 400, headers: corsHeaders 
    });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File;
  const fileName = formData.get('fileName') as string;

  if (!file) {
    return new Response('File is required', { 
      status: 400, headers: corsHeaders 
    });
  }

  const fileBuffer = await file.arrayBuffer();
  
  // Create metadata for the file
  const metadata = {
    name: fileName || file.name,
    parents: [tokenData.dedicated_folder_id],
  };

  // Upload to Google Drive using multipart upload
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const close_delim = `\r\n--${boundary}--`;

  const body = [
    delimiter,
    'Content-Type: application/json\r\n\r\n',
    JSON.stringify(metadata),
    delimiter,
    `Content-Type: ${file.type}\r\n\r\n`,
  ].join('') + new Uint8Array(fileBuffer) + close_delim;

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary="${boundary}"`,
        'Content-Length': body.length.toString(),
      },
      body,
    }
  );

  const data = await response.json();

  if (!response.ok) {
    console.error('Failed to upload file to Google Drive:', data);
    return new Response(JSON.stringify({ error: 'Failed to upload file' }), {
      status: response.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({
    message: 'File uploaded successfully',
    file: {
      id: data.id,
      name: data.name,
    }
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}