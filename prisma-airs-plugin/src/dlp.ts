/**
 * DLP masking utilities — regex-based PII/credential redaction.
 *
 * Shared by outbound and tool-protection hook groups.
 */

export function maskSensitiveData(content: string): string {
  let masked = content;

  // Social Security Numbers (XXX-XX-XXXX)
  masked = masked.replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN REDACTED]");

  // Credit Card Numbers (with or without spaces/dashes)
  masked = masked.replace(/\b(?:\d{4}[-\s]?){3}\d{4}\b/g, "[CARD REDACTED]");

  // Email addresses
  masked = masked.replace(
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    "[EMAIL REDACTED]"
  );

  // API keys and tokens (common patterns)
  masked = masked.replace(
    /\b(?:sk-|pk-|api[_-]?key[_-]?|token[_-]?|secret[_-]?|password[_-]?)[a-zA-Z0-9_-]{16,}\b/gi,
    "[API KEY REDACTED]"
  );

  // AWS keys
  masked = masked.replace(/\b(?:AKIA|ABIA|ACCA|ASIA)[A-Z0-9]{16}\b/g, "[AWS KEY REDACTED]");

  // Generic long alphanumeric strings that look like secrets (40+ chars)
  masked = masked.replace(/\b[a-zA-Z0-9_-]{40,}\b/g, (match) => {
    if (/[a-z]/.test(match) && /[A-Z]/.test(match) && /[0-9]/.test(match)) {
      return "[SECRET REDACTED]";
    }
    return match;
  });

  // US Phone numbers
  masked = masked.replace(
    /(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    "[PHONE REDACTED]"
  );

  // IP addresses (private ranges)
  masked = masked.replace(
    /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b/g,
    "[IP REDACTED]"
  );

  return masked;
}
