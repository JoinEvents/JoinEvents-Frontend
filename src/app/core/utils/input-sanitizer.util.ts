/**
 * Input sanitization utilities for defense-in-depth.
 * These complement server-side validation — never rely on client-side alone.
 */

/** Strip HTML tags from a string */
export function stripHtmlTags(input: string): string {
  if (!input) return '';
  return input.replace(/<[^>]*>/g, '');
}

/** Sanitize text input: trim whitespace, strip HTML, enforce max length */
export function sanitizeTextInput(input: string, maxLength: number = 500): string {
  if (!input) return '';
  let sanitized = input.trim();
  sanitized = stripHtmlTags(sanitized);
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  return sanitized;
}

/** Sanitize email input */
export function sanitizeEmail(input: string): string {
  if (!input) return '';
  return input.trim().toLowerCase();
}

/** Validate and sanitize file before upload */
export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export function validateFileUpload(
  file: File,
  allowedTypes: string[],
  maxSizeBytes: number
): FileValidationResult {
  if (!file) {
    return { valid: false, error: 'No file provided.' };
  }

  // Check file size
  if (file.size > maxSizeBytes) {
    const maxSizeMB = (maxSizeBytes / (1024 * 1024)).toFixed(1);
    return { valid: false, error: `File size exceeds ${maxSizeMB}MB limit.` };
  }

  // Check file type by MIME
  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    return { valid: false, error: `File type '${file.type}' is not allowed. Allowed: ${allowedTypes.join(', ')}` };
  }

  // Check file extension
  const fileName = file.name.toLowerCase();
  const dangerousExtensions = ['.exe', '.bat', '.cmd', '.sh', '.ps1', '.vbs', '.js', '.jar', '.msi'];
  if (dangerousExtensions.some(ext => fileName.endsWith(ext))) {
    return { valid: false, error: 'This file type is not allowed for security reasons.' };
  }

  return { valid: true };
}
