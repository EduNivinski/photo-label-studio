import { supabase } from "@/integrations/supabase/client";

interface SecurityEvent {
  event_type: 'auth_attempt' | 'file_upload' | 'sensitive_operation' | 'rate_limit_exceeded';
  user_id?: string;
  ip_address?: string;
  user_agent?: string;
  metadata?: Record<string, any>;
}

// Rate limiting storage (in-memory for client-side)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export const logSecurityEvent = async (event: SecurityEvent) => {
  try {
    // Get client info
    const clientInfo = {
      user_agent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      ...event
    };

    // Log to console in development and store locally for audit
    if (import.meta.env.DEV) {
      console.log('[Security Event]', clientInfo);
    }

    // Store in localStorage for client-side audit trail
    const auditKey = 'security_audit_log';
    const existingLogs = JSON.parse(localStorage.getItem(auditKey) || '[]');
    existingLogs.push(clientInfo);
    
    // Keep only last 100 events to prevent storage bloat
    if (existingLogs.length > 100) {
      existingLogs.splice(0, existingLogs.length - 100);
    }
    
    localStorage.setItem(auditKey, JSON.stringify(existingLogs));
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
};

export const checkRateLimit = (key: string, maxAttempts: number = 5, windowMs: number = 300000): boolean => {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (record.count >= maxAttempts) {
    logSecurityEvent({
      event_type: 'rate_limit_exceeded',
      metadata: { key, attempts: record.count, maxAttempts }
    });
    return false;
  }

  record.count++;
  return true;
};

export const validateSecureInput = (input: string, maxLength: number = 1000): boolean => {
  // Enhanced validation for security-sensitive inputs
  if (!input || input.length > maxLength) return false;
  
  // Check for suspicious patterns
  const suspiciousPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /data:text\/html/gi,
    /vbscript:/gi
  ];

  return !suspiciousPatterns.some(pattern => pattern.test(input));
};

export const sanitizeUserInput = (input: string): string => {
  return input
    .replace(/[<>'"]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim()
    .substring(0, 1000);
};