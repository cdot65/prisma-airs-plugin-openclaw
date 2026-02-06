/**
 * Prisma AIRS Outbound Security Scanner (message_sending)
 *
 * Scans ALL outbound responses for:
 * - WildFire: malicious URLs and content
 * - Toxicity: harmful/abusive content
 * - URL Filtering: disallowed URL categories
 * - DLP: sensitive data leakage
 * - Malicious Code: malware/exploits
 * - Custom Topics: org-specific policy violations
 * - Grounding: hallucination detection
 *
 * CAN BLOCK via { cancel: true } or modify via { content: "..." }
 */

import { scan, type ScanResult } from "../../src/scanner";

// Event shape from OpenClaw message_sending hook
interface MessageSendingEvent {
  content?: string;
  to?: string;
  channel?: string;
  metadata?: {
    sessionKey?: string;
    messageId?: string;
  };
}

// Context passed to hook
interface HookContext {
  channelId?: string;
  accountId?: string;
  conversationId?: string;
  cfg?: PluginConfig;
}

// Plugin config structure
interface PluginConfig {
  plugins?: {
    entries?: {
      "prisma-airs"?: {
        config?: {
          outbound_scanning_enabled?: boolean;
          profile_name?: string;
          app_name?: string;
          fail_closed?: boolean;
          dlp_mask_only?: boolean;
        };
      };
    };
  };
}

// Hook result type - can modify content or cancel
interface HookResult {
  content?: string;
  cancel?: boolean;
}

// Map AIRS categories to user-friendly messages
const CATEGORY_MESSAGES: Record<string, string> = {
  // Core detections (unsuffixed aliases)
  prompt_injection: "prompt injection attempt",
  dlp_prompt: "sensitive data in input",
  dlp_response: "sensitive data leakage",
  url_filtering_prompt: "disallowed URL in input",
  url_filtering_response: "disallowed URL in response",
  malicious_url: "malicious URL detected",
  toxicity: "inappropriate content",
  toxic_content: "inappropriate content",
  malicious_code: "malicious code detected",
  agent_threat: "AI agent threat",
  grounding: "response grounding violation",
  ungrounded: "ungrounded response",
  custom_topic: "policy violation",
  topic_violation: "policy violation",
  db_security: "database security threat",
  // Suffixed variants (from scanner category builder)
  toxic_content_prompt: "inappropriate content in input",
  toxic_content_response: "inappropriate content in response",
  malicious_code_prompt: "malicious code in input",
  malicious_code_response: "malicious code in response",
  agent_threat_prompt: "AI agent threat in input",
  agent_threat_response: "AI agent threat in response",
  topic_violation_prompt: "policy violation in input",
  topic_violation_response: "policy violation in response",
  db_security_response: "database security threat in response",
  ungrounded_response: "ungrounded response",
  // Meta
  safe: "safe",
  benign: "safe",
  api_error: "security scan error",
  "scan-failure": "security scan failed",
};

// Categories that can be masked instead of blocked
const MASKABLE_CATEGORIES = ["dlp_response", "dlp_prompt", "dlp"];

// Categories that always require full block
const ALWAYS_BLOCK_CATEGORIES = [
  "malicious_code",
  "malicious_code_prompt",
  "malicious_code_response",
  "malicious_url",
  "toxicity",
  "toxic_content",
  "toxic_content_prompt",
  "toxic_content_response",
  "agent_threat",
  "agent_threat_prompt",
  "agent_threat_response",
  "prompt_injection",
  "db_security",
  "db_security_response",
  "scan-failure",
];

/**
 * Get plugin configuration
 */
function getPluginConfig(ctx: HookContext): {
  enabled: boolean;
  profileName: string;
  appName: string;
  failClosed: boolean;
  dlpMaskOnly: boolean;
} {
  const cfg = ctx.cfg?.plugins?.entries?.["prisma-airs"]?.config;
  return {
    enabled: cfg?.outbound_scanning_enabled !== false,
    profileName: cfg?.profile_name ?? "default",
    appName: cfg?.app_name ?? "openclaw",
    failClosed: cfg?.fail_closed ?? true, // Default fail-closed
    dlpMaskOnly: cfg?.dlp_mask_only ?? true, // Default mask instead of block for DLP
  };
}

/**
 * Mask sensitive data in content
 *
 * Uses regex patterns for common PII types.
 * TODO: Use AIRS API match offsets for precision masking when available.
 */
function maskSensitiveData(content: string): string {
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
    // Only redact if it looks like a key (has mixed case or numbers)
    if (/[a-z]/.test(match) && /[A-Z]/.test(match) && /[0-9]/.test(match)) {
      return "[SECRET REDACTED]";
    }
    return match;
  });

  // US Phone numbers
  masked = masked.replace(
    /\b(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    "[PHONE REDACTED]"
  );

  // IP addresses (private ranges especially)
  masked = masked.replace(
    /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b/g,
    "[IP REDACTED]"
  );

  return masked;
}

/**
 * Build user-friendly block message
 */
function buildBlockMessage(result: ScanResult): string {
  const reasons = result.categories
    .map((cat) => CATEGORY_MESSAGES[cat] || cat.replace(/_/g, " "))
    .filter((r) => r !== "safe")
    .join(", ");

  return (
    `I apologize, but I'm unable to provide that response due to security policy` +
    (reasons ? ` (${reasons})` : "") +
    `. Please rephrase your request or contact support if you believe this is an error.`
  );
}

/**
 * Determine if result should be masked vs blocked
 */
function shouldMaskOnly(result: ScanResult, config: { dlpMaskOnly: boolean }): boolean {
  if (!config.dlpMaskOnly) return false;

  // Check if any always-block categories are present
  const hasBlockingCategory = result.categories.some((cat) =>
    ALWAYS_BLOCK_CATEGORIES.includes(cat)
  );
  if (hasBlockingCategory) return false;

  // Check if all categories are maskable
  const allMaskable = result.categories.every(
    (cat) => MASKABLE_CATEGORIES.includes(cat) || cat === "safe" || cat === "benign"
  );

  return allMaskable;
}

/**
 * Main hook handler
 */
const handler = async (
  event: MessageSendingEvent,
  ctx: HookContext
): Promise<HookResult | void> => {
  const config = getPluginConfig(ctx);

  // Check if outbound scanning is enabled
  if (!config.enabled) {
    return;
  }

  // Validate we have content to scan
  const content = event.content;
  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return;
  }

  const sessionKey = event.metadata?.sessionKey || ctx.conversationId || "unknown";

  let result: ScanResult;

  try {
    // Scan the outbound response
    result = await scan({
      response: content,
      profileName: config.profileName,
      appName: config.appName,
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        event: "prisma_airs_outbound_scan_error",
        timestamp: new Date().toISOString(),
        sessionKey,
        error: err instanceof Error ? err.message : String(err),
      })
    );

    // Fail-closed: block on scan failure
    if (config.failClosed) {
      return {
        content:
          "I apologize, but I'm unable to provide a response at this time due to a security verification issue. Please try again.",
      };
    }

    return; // Fail-open
  }

  // Log the scan result
  console.log(
    JSON.stringify({
      event: "prisma_airs_outbound_scan",
      timestamp: new Date().toISOString(),
      sessionKey,
      action: result.action,
      severity: result.severity,
      categories: result.categories,
      scanId: result.scanId,
      reportId: result.reportId,
      latencyMs: result.latencyMs,
      responseDetected: result.responseDetected,
    })
  );

  // Handle allow - no modification needed
  if (result.action === "allow") {
    return;
  }

  // Handle warn - log but allow through
  if (result.action === "warn") {
    console.log(
      JSON.stringify({
        event: "prisma_airs_outbound_warn",
        timestamp: new Date().toISOString(),
        sessionKey,
        severity: result.severity,
        categories: result.categories,
        scanId: result.scanId,
      })
    );
    return; // Allow through with warning logged
  }

  // Handle block
  if (result.action === "block") {
    // Check if we should mask instead of block (DLP-only)
    if (shouldMaskOnly(result, config)) {
      const maskedContent = maskSensitiveData(content);

      // Only return modified content if masking actually changed something
      if (maskedContent !== content) {
        console.log(
          JSON.stringify({
            event: "prisma_airs_outbound_mask",
            timestamp: new Date().toISOString(),
            sessionKey,
            categories: result.categories,
            scanId: result.scanId,
          })
        );

        return {
          content: maskedContent,
        };
      }
    }

    // Full block - replace content entirely
    console.log(
      JSON.stringify({
        event: "prisma_airs_outbound_block",
        timestamp: new Date().toISOString(),
        sessionKey,
        action: result.action,
        severity: result.severity,
        categories: result.categories,
        scanId: result.scanId,
        reportId: result.reportId,
      })
    );

    return {
      content: buildBlockMessage(result),
    };
  }
};

export default handler;
