import { useEffect } from 'react';
import { logSecurityHeadersRecommendation, performClientSecurityChecks } from '@/lib/securityHeaders';
import { logSecurityEvent } from '@/lib/securityMonitoring';

export const useSecurityInit = () => {
  useEffect(() => {
    // Initialize security monitoring
    const initSecurity = () => {
      // Log security headers recommendation for production
      logSecurityHeadersRecommendation();
      
      // Perform client-side security checks
      const securityChecks = performClientSecurityChecks();
      
      // Log application start with security status
      logSecurityEvent({
        event_type: 'sensitive_operation',
        metadata: {
          action: 'app_initialized',
          https: securityChecks.https,
          mixedContent: securityChecks.mixedContent,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString()
        }
      });
    };
    
    initSecurity();
  }, []);
};