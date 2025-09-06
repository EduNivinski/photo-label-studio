import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FileValidationRequest {
  fileName: string;
  fileSize: number;
  mimeType: string;
  fileExtension: string;
}

interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedFileName?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { fileName, fileSize, mimeType, fileExtension }: FileValidationRequest = await req.json();

    const validation = validateFile({ fileName, fileSize, mimeType, fileExtension });

    return new Response(
      JSON.stringify(validation),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('File validation error:', error);
    return new Response(
      JSON.stringify({ error: 'Validation failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function validateFile(request: FileValidationRequest): FileValidationResult {
  const errors: string[] = [];
  const { fileName, fileSize, mimeType, fileExtension } = request;

  // File size validation (50MB limit)
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  if (fileSize > MAX_FILE_SIZE) {
    errors.push('File size exceeds 50MB limit');
  }

  // MIME type validation
  const allowedMimeTypes = [
    // Images
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp',
    'image/tiff', 'image/svg+xml', 'image/x-canon-cr2', 'image/x-canon-crw',
    'image/x-nikon-nef', 'image/x-sony-arw', 'image/x-adobe-dng',
    // Videos
    'video/mp4', 'video/mov', 'video/avi', 'video/webm', 'video/mkv',
    'video/quicktime', 'video/x-msvideo', 'video/x-ms-wmv'
  ];

  if (!allowedMimeTypes.includes(mimeType)) {
    errors.push('File type not supported');
  }

  // File extension validation
  const allowedExtensions = [
    // Images
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.tif', '.svg',
    '.cr2', '.crw', '.nef', '.arw', '.dng', '.raw',
    // Videos
    '.mp4', '.mov', '.avi', '.webm', '.mkv', '.flv', '.wmv'
  ];

  const normalizedExtension = fileExtension.toLowerCase();
  if (!allowedExtensions.includes(normalizedExtension)) {
    errors.push('File extension not allowed');
  }

  // MIME type and extension consistency check
  const isImage = mimeType.startsWith('image/');
  const isVideo = mimeType.startsWith('video/');
  const extensionIsImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.tif', '.svg', '.cr2', '.crw', '.nef', '.arw', '.dng', '.raw'].includes(normalizedExtension);
  const extensionIsVideo = ['.mp4', '.mov', '.avi', '.webm', '.mkv', '.flv', '.wmv'].includes(normalizedExtension);

  if ((isImage && !extensionIsImage) || (isVideo && !extensionIsVideo)) {
    errors.push('File type and extension mismatch');
  }

  // File name validation and sanitization
  const sanitizedFileName = sanitizeFileName(fileName);
  if (!sanitizedFileName) {
    errors.push('Invalid file name');
  }

  // Additional security checks
  if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
    errors.push('File name contains invalid characters');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedFileName: errors.length === 0 ? sanitizedFileName : undefined
  };
}

function sanitizeFileName(fileName: string): string {
  // Remove any path traversal attempts and dangerous characters
  let sanitized = fileName
    .replace(/[^\w\s.-]/gi, '') // Only allow word chars, spaces, dots, dashes
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .replace(/^[.-]+|[.-]+$/g, ''); // Remove leading/trailing dots or dashes

  // Ensure file has an extension
  if (!sanitized.includes('.')) {
    sanitized = sanitized + '.unknown';
  }

  // Limit length
  if (sanitized.length > 255) {
    const ext = sanitized.split('.').pop();
    const name = sanitized.substring(0, 255 - ext!.length - 1);
    sanitized = `${name}.${ext}`;
  }

  return sanitized;
}