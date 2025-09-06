// Centralized error handling and logging

export interface SafeError {
  message: string;
  code?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// Safe error messages that don't expose internal details
const SAFE_ERROR_MESSAGES = {
  // Authentication errors
  'auth/invalid-credentials': 'Invalid email or password',
  'auth/user-not-found': 'Invalid email or password',
  'auth/wrong-password': 'Invalid email or password',
  'auth/too-many-requests': 'Too many failed attempts. Please try again later',
  'auth/user-disabled': 'This account has been disabled',
  'auth/email-already-in-use': 'An account with this email already exists',
  'auth/weak-password': 'Password should be at least 6 characters',
  'auth/invalid-email': 'Invalid email address',
  
  // Upload errors
  'storage/unauthorized': 'You are not authorized to upload files',
  'storage/quota-exceeded': 'Storage quota exceeded',
  'storage/invalid-format': 'Invalid file format',
  'storage/file-too-large': 'File size exceeds the maximum limit',
  
  // Database errors
  'db/permission-denied': 'You do not have permission to perform this action',
  'db/validation-failed': 'The provided data is invalid',
  'db/not-found': 'The requested item was not found',
  'db/duplicate': 'An item with this name already exists',
  
  // Network errors
  'network/timeout': 'Request timed out. Please check your connection',
  'network/offline': 'You appear to be offline. Please check your connection',
  'network/server-error': 'Server error. Please try again later',
  
  // Generic errors
  'generic/unknown': 'An unexpected error occurred. Please try again',
  'generic/invalid-input': 'Invalid input provided',
  'generic/rate-limited': 'Too many requests. Please slow down'
};

export function sanitizeError(error: any): SafeError {
  // Don't log sensitive error details in production
  const isProduction = window.location.hostname !== 'localhost';
  
  if (!isProduction) {
    console.error('Detailed error (dev only):', error);
  }

  // Map specific error types to safe messages
  let safeMessage = SAFE_ERROR_MESSAGES['generic/unknown'];
  let severity: SafeError['severity'] = 'medium';
  let code: string | undefined;

  if (error?.code) {
    code = error.code;
    if (SAFE_ERROR_MESSAGES[error.code as keyof typeof SAFE_ERROR_MESSAGES]) {
      safeMessage = SAFE_ERROR_MESSAGES[error.code as keyof typeof SAFE_ERROR_MESSAGES];
    }
  }

  // Categorize severity based on error type
  if (error?.code?.startsWith('auth/')) {
    severity = error.code === 'auth/too-many-requests' ? 'high' : 'medium';
  } else if (error?.code?.startsWith('storage/')) {
    severity = 'medium';
  } else if (error?.code?.startsWith('db/')) {
    severity = error.code === 'db/permission-denied' ? 'high' : 'medium';
  } else if (error?.code?.startsWith('network/')) {
    severity = 'low';
  }

  // Handle specific error patterns
  if (error?.message?.includes('JWT')) {
    safeMessage = 'Your session has expired. Please log in again';
    severity = 'medium';
    code = 'auth/session-expired';
  } else if (error?.message?.includes('RLS') || error?.message?.includes('row-level security')) {
    safeMessage = 'You do not have permission to perform this action';
    severity = 'high';
    code = 'db/permission-denied';
  } else if (error?.message?.includes('duplicate key')) {
    safeMessage = 'An item with this name already exists';
    severity = 'low';
    code = 'db/duplicate';
  } else if (error?.message?.includes('foreign key')) {
    safeMessage = 'Cannot complete this action due to data dependencies';
    severity = 'medium';
    code = 'db/constraint-violation';
  }

  // Log security events (without sensitive details)  
  if (severity === 'high') {
    logSecurityEvent({
      type: 'error',
      severity,
      code,
      message: safeMessage,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    });
  }

  return {
    message: safeMessage,
    code,
    severity
  };
}

interface SecurityEvent {
  type: 'error' | 'warning' | 'suspicious';
  severity: 'low' | 'medium' | 'high' | 'critical';
  code?: string;
  message: string;
  timestamp: string;
  userAgent: string;
  url: string;
}

function logSecurityEvent(event: SecurityEvent): void {
  // In a real application, you would send this to a security monitoring service
  // For now, we'll just log it with a specific format for easy filtering
  console.warn('SECURITY_EVENT:', JSON.stringify(event));
  
  // You could also send to an external monitoring service here
  // Example: sendToSecurityMonitoring(event);
}

export function handleAsyncError<T>(
  promise: Promise<T>,
  context: string
): Promise<[SafeError | null, T | null]> {
  return promise
    .then<[null, T]>((data: T) => [null, data])
    .catch<[SafeError, null]>((error: any) => {
      const safeError = sanitizeError(error);
      
      // Log the context for debugging (safe in production)
      console.error(`Error in ${context}:`, safeError.message);
      
      return [safeError, null];
    });
}

export function createErrorHandler(context: string) {
  return (error: any): SafeError => {
    const safeError = sanitizeError(error);
    console.error(`Error in ${context}:`, safeError.message);
    return safeError;
  };
}