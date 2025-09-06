// Security headers utility for enhanced protection
// Note: These headers are best configured at the server/hosting level
// This is a utility for documenting recommended security headers

export const RECOMMENDED_SECURITY_HEADERS = {
  // Prevent clickjacking attacks
  'X-Frame-Options': 'DENY',
  
  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',
  
  // Enable XSS protection
  'X-XSS-Protection': '1; mode=block',
  
  // Referrer policy for privacy
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  
  // Content Security Policy (adjust based on your needs)
  'Content-Security-Policy': `
    default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: blob: https:;
    font-src 'self' data:;
    connect-src 'self' https://*.supabase.co wss://*.supabase.co;
    media-src 'self' blob:;
  `.replace(/\s+/g, ' ').trim(),
  
  // Strict Transport Security (for HTTPS sites)
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  
  // Permissions policy
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
} as const;

// Function to log recommended security headers for hosting configuration
export const logSecurityHeadersRecommendation = () => {
  if (import.meta.env.DEV) {
    console.group('🔒 Recommended Security Headers for Production');
    console.log('Configure these headers in your hosting provider:');
    Object.entries(RECOMMENDED_SECURITY_HEADERS).forEach(([header, value]) => {
      console.log(`${header}: ${value}`);
    });
    console.log('\nFor Netlify: Use _headers file');
    console.log('For Vercel: Use vercel.json headers config');
    console.log('For Cloudflare: Use Transform Rules');
    console.groupEnd();
  }
};

// Basic client-side security checks
export const performClientSecurityChecks = () => {
  const checks = {
    https: location.protocol === 'https:' || location.hostname === 'localhost',
    mixedContent: document.querySelectorAll('img[src^="http:"], script[src^="http:"]').length === 0,
    xFrameOptions: true // Can't check this client-side
  };
  
  if (import.meta.env.DEV) {
    console.group('🔍 Client Security Checks');
    console.log('HTTPS:', checks.https ? '✅' : '❌');
    console.log('No Mixed Content:', checks.mixedContent ? '✅' : '❌');
    console.log('Consider configuring X-Frame-Options header');
    console.groupEnd();
  }
  
  return checks;
};