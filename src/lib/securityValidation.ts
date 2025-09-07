// Comprehensive security validation system for end users
import { logSecurityEvent } from './securityMonitoring';
import { validateSecureInput, sanitizeUserInput, checkRateLimit } from './securityMonitoring';
import { ValidationResult, validateFileName, validateSearchTerm } from './validation';

export interface SecurityContext {
  userId: string;
  action: string;
  metadata: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface SecurityValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  sanitizedData?: Record<string, any>;
  securityFlags: string[];
}

// Enhanced input validation with security monitoring
export class SecurityValidator {
  private static instance: SecurityValidator;
  private readonly maxRequestsPerMinute = 60;
  private readonly maxRequestsPerHour = 1000;

  public static getInstance(): SecurityValidator {
    if (!SecurityValidator.instance) {
      SecurityValidator.instance = new SecurityValidator();
    }
    return SecurityValidator.instance;
  }

  // Validate Google Drive connection request
  async validateGoogleDriveConnection(
    data: { code?: string; state?: string },
    context: SecurityContext
  ): Promise<SecurityValidationResult> {
    const errors: ValidationError[] = [];
    const securityFlags: string[] = [];
    const sanitizedData: Record<string, any> = {};

    // Rate limiting check
    const rateLimitKey = `gd_connect_${context.userId}`;
    if (!checkRateLimit(rateLimitKey, 5, 300000)) { // 5 attempts per 5 minutes
      errors.push({
        field: 'rate_limit',
        message: 'Too many connection attempts. Please try again later.',
        severity: 'high'
      });
      securityFlags.push('RATE_LIMIT_EXCEEDED');
      
      await logSecurityEvent({
        event_type: 'rate_limit_exceeded',
        user_id: context.userId,
        metadata: { action: 'google_drive_connection', ...context.metadata }
      });
    }

    // Validate authorization code
    if (data.code) {
      if (!validateSecureInput(data.code, 2048)) {
        errors.push({
          field: 'code',
          message: 'Invalid authorization code format',
          severity: 'critical'
        });
        securityFlags.push('INVALID_AUTH_CODE');
      } else {
        sanitizedData.code = sanitizeUserInput(data.code);
      }
    }

    // Validate state parameter
    if (data.state) {
      if (!validateSecureInput(data.state, 256)) {
        errors.push({
          field: 'state',
          message: 'Invalid state parameter format',
          severity: 'high'
        });
        securityFlags.push('INVALID_STATE');
      } else {
        sanitizedData.state = sanitizeUserInput(data.state);
      }
    }

    // Log security validation event
    await logSecurityEvent({
      event_type: 'sensitive_operation',
      user_id: context.userId,
      metadata: {
        action: 'google_drive_validation',
        errors_count: errors.length,
        security_flags: securityFlags,
        ...context.metadata
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData,
      securityFlags
    };
  }

  // Validate file operations
  async validateFileOperation(
    data: { fileName?: string; fileId?: string; folderId?: string },
    context: SecurityContext
  ): Promise<SecurityValidationResult> {
    const errors: ValidationError[] = [];
    const securityFlags: string[] = [];
    const sanitizedData: Record<string, any> = {};

    // Rate limiting for file operations
    const rateLimitKey = `file_op_${context.userId}`;
    if (!checkRateLimit(rateLimitKey, 100, 60000)) { // 100 operations per minute
      errors.push({
        field: 'rate_limit',
        message: 'Too many file operations. Please slow down.',
        severity: 'medium'
      });
      securityFlags.push('FILE_OPERATION_RATE_LIMIT');
    }

    // Validate file name
    if (data.fileName) {
      const fileValidation = validateFileName(data.fileName);
      if (!fileValidation.isValid) {
        errors.push({
          field: 'fileName',
          message: fileValidation.errors.join(', '),
          severity: 'medium'
        });
        securityFlags.push('INVALID_FILENAME');
      } else {
        sanitizedData.fileName = fileValidation.sanitized;
      }
    }

    // Validate file ID format
    if (data.fileId) {
      if (!/^[a-zA-Z0-9_-]+$/.test(data.fileId) || data.fileId.length > 128) {
        errors.push({
          field: 'fileId',
          message: 'Invalid file ID format',
          severity: 'high'
        });
        securityFlags.push('INVALID_FILE_ID');
      } else {
        sanitizedData.fileId = data.fileId;
      }
    }

    // Validate folder ID format
    if (data.folderId) {
      if (!/^[a-zA-Z0-9_-]+$/.test(data.folderId) || data.folderId.length > 128) {
        errors.push({
          field: 'folderId',
          message: 'Invalid folder ID format',
          severity: 'high'
        });
        securityFlags.push('INVALID_FOLDER_ID');
      } else {
        sanitizedData.folderId = data.folderId;
      }
    }

    await logSecurityEvent({
      event_type: 'sensitive_operation',
      user_id: context.userId,
      metadata: {
        action: 'file_operation_validation',
        errors_count: errors.length,
        security_flags: securityFlags,
        ...context.metadata
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData,
      securityFlags
    };
  }

  // Validate search operations
  async validateSearchOperation(
    data: { searchTerm?: string; filters?: Record<string, any> },
    context: SecurityContext
  ): Promise<SecurityValidationResult> {
    const errors: ValidationError[] = [];
    const securityFlags: string[] = [];
    const sanitizedData: Record<string, any> = {};

    // Rate limiting for search operations
    const rateLimitKey = `search_${context.userId}`;
    if (!checkRateLimit(rateLimitKey, 50, 60000)) { // 50 searches per minute
      errors.push({
        field: 'rate_limit',
        message: 'Too many search requests. Please wait.',
        severity: 'medium'
      });
      securityFlags.push('SEARCH_RATE_LIMIT');
    }

    // Validate search term
    if (data.searchTerm) {
      const searchValidation = validateSearchTerm(data.searchTerm);
      if (!searchValidation.isValid) {
        errors.push({
          field: 'searchTerm',
          message: searchValidation.errors.join(', '),
          severity: 'high'
        });
        securityFlags.push('INVALID_SEARCH_TERM');
      } else {
        sanitizedData.searchTerm = searchValidation.sanitized;
      }
    }

    // Validate filters
    if (data.filters) {
      const filterKeys = Object.keys(data.filters);
      const allowedFilters = ['dateFrom', 'dateTo', 'labels', 'mediaType', 'collection'];
      
      for (const key of filterKeys) {
        if (!allowedFilters.includes(key)) {
          errors.push({
            field: 'filters',
            message: `Invalid filter key: ${key}`,
            severity: 'medium'
          });
          securityFlags.push('INVALID_FILTER_KEY');
        }
      }

      if (errors.length === 0) {
        sanitizedData.filters = data.filters;
      }
    }

    await logSecurityEvent({
      event_type: 'sensitive_operation',
      user_id: context.userId,
      metadata: {
        action: 'search_validation',
        errors_count: errors.length,
        security_flags: securityFlags,
        search_term_length: data.searchTerm?.length || 0,
        ...context.metadata
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData,
      securityFlags
    };
  }

  // Validate user profile operations
  async validateProfileOperation(
    data: { displayName?: string; avatarUrl?: string },
    context: SecurityContext
  ): Promise<SecurityValidationResult> {
    const errors: ValidationError[] = [];
    const securityFlags: string[] = [];
    const sanitizedData: Record<string, any> = {};

    // Rate limiting for profile updates
    const rateLimitKey = `profile_${context.userId}`;
    if (!checkRateLimit(rateLimitKey, 10, 300000)) { // 10 updates per 5 minutes
      errors.push({
        field: 'rate_limit',
        message: 'Too many profile updates. Please wait.',
        severity: 'medium'
      });
      securityFlags.push('PROFILE_RATE_LIMIT');
    }

    // Validate display name
    if (data.displayName !== undefined) {
      if (!validateSecureInput(data.displayName, 100)) {
        errors.push({
          field: 'displayName',
          message: 'Invalid display name format',
          severity: 'medium'
        });
        securityFlags.push('INVALID_DISPLAY_NAME');
      } else {
        sanitizedData.displayName = sanitizeUserInput(data.displayName);
      }
    }

    // Validate avatar URL
    if (data.avatarUrl !== undefined) {
      try {
        if (data.avatarUrl && !data.avatarUrl.startsWith('https://')) {
          errors.push({
            field: 'avatarUrl',
            message: 'Avatar URL must use HTTPS',
            severity: 'medium'
          });
          securityFlags.push('INSECURE_AVATAR_URL');
        } else {
          sanitizedData.avatarUrl = data.avatarUrl;
        }
      } catch {
        errors.push({
          field: 'avatarUrl',
          message: 'Invalid avatar URL format',
          severity: 'medium'
        });
        securityFlags.push('MALFORMED_AVATAR_URL');
      }
    }

    await logSecurityEvent({
      event_type: 'sensitive_operation',
      user_id: context.userId,
      metadata: {
        action: 'profile_validation',
        errors_count: errors.length,
        security_flags: securityFlags,
        ...context.metadata
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData,
      securityFlags
    };
  }

  // General purpose data validation
  async validateGenericData(
    data: Record<string, any>,
    schema: Record<string, { type: string; required?: boolean; maxLength?: number }>,
    context: SecurityContext
  ): Promise<SecurityValidationResult> {
    const errors: ValidationError[] = [];
    const securityFlags: string[] = [];
    const sanitizedData: Record<string, any> = {};

    for (const [field, rules] of Object.entries(schema)) {
      const value = data[field];

      // Check required fields
      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push({
          field,
          message: `${field} is required`,
          severity: 'medium'
        });
        continue;
      }

      // Skip validation for undefined optional fields
      if (value === undefined || value === null) {
        continue;
      }

      // Type validation
      if (rules.type === 'string' && typeof value !== 'string') {
        errors.push({
          field,
          message: `${field} must be a string`,
          severity: 'medium'
        });
        continue;
      }

      // Length validation
      if (rules.type === 'string' && rules.maxLength && value.length > rules.maxLength) {
        errors.push({
          field,
          message: `${field} exceeds maximum length of ${rules.maxLength}`,
          severity: 'medium'
        });
        continue;
      }

      // Security validation
      if (rules.type === 'string' && !validateSecureInput(value, rules.maxLength)) {
        errors.push({
          field,
          message: `${field} contains potentially dangerous content`,
          severity: 'high'
        });
        securityFlags.push(`UNSAFE_${field.toUpperCase()}`);
        continue;
      }

      // Sanitize valid data
      if (rules.type === 'string') {
        sanitizedData[field] = sanitizeUserInput(value);
      } else {
        sanitizedData[field] = value;
      }
    }

    await logSecurityEvent({
      event_type: 'sensitive_operation',
      user_id: context.userId,
      metadata: {
        action: 'generic_validation',
        errors_count: errors.length,
        security_flags: securityFlags,
        fields_validated: Object.keys(schema),
        ...context.metadata
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData,
      securityFlags
    };
  }
}

// Convenience function to get the singleton instance
export const securityValidator = SecurityValidator.getInstance();