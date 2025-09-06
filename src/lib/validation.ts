// Input validation and sanitization utilities

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitized?: string;
}

// Sanitize string input to prevent XSS and injection attacks
export function sanitizeString(input: string, maxLength: number = 255): ValidationResult {
  const errors: string[] = [];
  
  if (!input || typeof input !== 'string') {
    errors.push('Input is required and must be a string');
    return { isValid: false, errors };
  }

  if (input.length > maxLength) {
    errors.push(`Input must be ${maxLength} characters or less`);
  }

  // Remove potential XSS vectors
  const sanitized = input
    .trim()
    .replace(/[<>\"'&]/g, '') // Remove basic HTML/XSS chars
    .replace(/javascript:/gi, '') // Remove javascript: URLs
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .replace(/\0/g, ''); // Remove null bytes

  if (sanitized !== input) {
    console.warn('Input was sanitized, potential security issue detected');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: sanitized.substring(0, maxLength)
  };
}

// Validate label names
export function validateLabel(name: string, color?: string): ValidationResult {
  const nameValidation = sanitizeString(name, 50);
  
  if (!nameValidation.isValid) {
    return nameValidation;
  }

  const errors: string[] = [];
  
  // Check for minimum length
  if (nameValidation.sanitized!.length < 1) {
    errors.push('Label name cannot be empty');
  }

  // Validate color if provided
  if (color) {
    const colorRegex = /^#[0-9A-Fa-f]{6}$/;
    if (!colorRegex.test(color)) {
      errors.push('Color must be a valid hex color code');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: nameValidation.sanitized
  };
}

// Validate photo alias/name
export function validatePhotoAlias(alias: string): ValidationResult {
  const validation = sanitizeString(alias, 100);
  
  if (!validation.isValid) {
    return validation;
  }

  // Additional validation for photo aliases
  const errors: string[] = [];
  
  if (validation.sanitized!.length < 1) {
    errors.push('Photo name cannot be empty');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: validation.sanitized
  };
}

// Validate search terms
export function validateSearchTerm(searchTerm: string): ValidationResult {
  const validation = sanitizeString(searchTerm, 200);
  
  if (!validation.isValid) {
    return validation;
  }

  const errors: string[] = [];
  
  // Prevent SQL injection patterns
  const dangerousPatterns = [
    /union\s+select/gi,
    /drop\s+table/gi,
    /delete\s+from/gi,
    /insert\s+into/gi,
    /update\s+set/gi,
    /';--/gi,
    /\/\*.*\*\//gi
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(validation.sanitized!)) {
      errors.push('Search term contains invalid characters');
      break;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: validation.sanitized
  };
}

// Validate file names on client side
export function validateFileName(fileName: string): ValidationResult {
  const validation = sanitizeString(fileName, 255);
  
  if (!validation.isValid) {
    return validation;
  }

  const errors: string[] = [];
  
  // Check for path traversal attempts
  if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
    errors.push('File name contains invalid path characters');
  }

  // Check for reserved names (Windows)
  const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
  const baseName = validation.sanitized!.split('.')[0].toUpperCase();
  if (reservedNames.includes(baseName)) {
    errors.push('File name uses a reserved system name');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: validation.sanitized
  };
}