import { useState, useCallback } from 'react';
import { SecurityValidator, SecurityContext, SecurityValidationResult } from '@/lib/securityValidation';
import { useToast } from './use-toast';
import { supabase } from '@/integrations/supabase/client';

export function useSecurityValidation() {
  const [isValidating, setIsValidating] = useState(false);
  const { toast } = useToast();
  const validator = SecurityValidator.getInstance();

  const createSecurityContext = useCallback(async (action: string, metadata: Record<string, any> = {}): Promise<SecurityContext> => {
    const { data: { session } } = await supabase.auth.getSession();
    
    return {
      userId: session?.user?.id || 'anonymous',
      action,
      metadata: {
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        ...metadata
      }
    };
  }, []);

  const handleValidationResult = useCallback((result: SecurityValidationResult, showToast: boolean = true) => {
    if (!result.isValid && showToast) {
      const criticalErrors = result.errors.filter(e => e.severity === 'critical');
      const highErrors = result.errors.filter(e => e.severity === 'high');
      
      if (criticalErrors.length > 0) {
        toast({
          title: "Erro de Segurança Crítico",
          description: "Operação bloqueada por motivos de segurança. Entre em contato com o suporte.",
          variant: "destructive",
        });
      } else if (highErrors.length > 0) {
        toast({
          title: "Erro de Validação",
          description: highErrors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Dados Inválidos",
          description: result.errors[0]?.message || "Por favor, verifique os dados informados.",
          variant: "destructive",
        });
      }
    }

    return result;
  }, [toast]);

  const validateGoogleDriveConnection = useCallback(async (
    data: { code?: string; state?: string },
    metadata: Record<string, any> = {},
    showToast: boolean = true
  ): Promise<SecurityValidationResult> => {
    setIsValidating(true);
    try {
      const context = await createSecurityContext('google_drive_connection', metadata);
      const result = await validator.validateGoogleDriveConnection(data, context);
      return handleValidationResult(result, showToast);
    } finally {
      setIsValidating(false);
    }
  }, [validator, createSecurityContext, handleValidationResult]);

  const validateFileOperation = useCallback(async (
    data: { fileName?: string; fileId?: string; folderId?: string },
    metadata: Record<string, any> = {},
    showToast: boolean = true
  ): Promise<SecurityValidationResult> => {
    setIsValidating(true);
    try {
      const context = await createSecurityContext('file_operation', metadata);
      const result = await validator.validateFileOperation(data, context);
      return handleValidationResult(result, showToast);
    } finally {
      setIsValidating(false);
    }
  }, [validator, createSecurityContext, handleValidationResult]);

  const validateSearchOperation = useCallback(async (
    data: { searchTerm?: string; filters?: Record<string, any> },
    metadata: Record<string, any> = {},
    showToast: boolean = true
  ): Promise<SecurityValidationResult> => {
    setIsValidating(true);
    try {
      const context = await createSecurityContext('search_operation', metadata);
      const result = await validator.validateSearchOperation(data, context);
      return handleValidationResult(result, showToast);
    } finally {
      setIsValidating(false);
    }
  }, [validator, createSecurityContext, handleValidationResult]);

  const validateProfileOperation = useCallback(async (
    data: { displayName?: string; avatarUrl?: string },
    metadata: Record<string, any> = {},
    showToast: boolean = true
  ): Promise<SecurityValidationResult> => {
    setIsValidating(true);
    try {
      const context = await createSecurityContext('profile_operation', metadata);
      const result = await validator.validateProfileOperation(data, context);
      return handleValidationResult(result, showToast);
    } finally {
      setIsValidating(false);
    }
  }, [validator, createSecurityContext, handleValidationResult]);

  const validateGenericData = useCallback(async (
    data: Record<string, any>,
    schema: Record<string, { type: string; required?: boolean; maxLength?: number }>,
    action: string,
    metadata: Record<string, any> = {},
    showToast: boolean = true
  ): Promise<SecurityValidationResult> => {
    setIsValidating(true);
    try {
      const context = await createSecurityContext(action, metadata);
      const result = await validator.validateGenericData(data, schema, context);
      return handleValidationResult(result, showToast);
    } finally {
      setIsValidating(false);
    }
  }, [validator, createSecurityContext, handleValidationResult]);

  return {
    isValidating,
    validateGoogleDriveConnection,
    validateFileOperation,
    validateSearchOperation,
    validateProfileOperation,
    validateGenericData,
  };
}