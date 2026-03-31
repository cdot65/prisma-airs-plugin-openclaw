/**
 * Outbound Scanning Hook Group
 *
 * Merges outbound (message_sending) and outbound-block (before_message_write
 * for assistant messages) into a single registration function.
 *
 * message_sending  - Scans response; DLP mask or full block based on verdict.
 * before_message_write (assistant) - Hard block unless AIRS returns "allow".
 */

import { scan, type ScanResult } from "../../src/scanner.ts";
import { maskSensitiveData } from "../../src/dlp.ts";
import type { PrismaAirsConfig } from "../../src/config.ts";

// ── Re-export ScanResult for downstream consumers ────────────────
export type { ScanResult } from "../../src/scanner.ts";

// ── Shared types ─────────────────────────────────────────────────

interface PluginApi {
  on: (event: string, handler: (...args: any[]) => any) => void;
  logger: { info: (msg: string) => void; debug: (msg: string) => void };
}

interface HookCtxFn {
  (ctx: any): any;
}

interface MessageSendingEvent {
  content?: string;
  to?: string;
  channel?: string;
  metadata?: {
    sessionKey?: string;
    messageId?: string;
  };
}

interface MessageWriteEvent {
  content?: string;
  role?: string;
  metadata?: {
    sessionKey?: string;
    messageId?: string;
  };
}

interface MessageSendingResult {
  content?: string;
  cancel?: boolean;
}

interface MessageWriteResult {
  block: boolean;
}

// ── Constants ────────────────────────────────────────────────────

/** Map AIRS categories to user-friendly messages */
export const CATEGORY_MESSAGES: Record<string, string> = {
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

/** Categories that can be masked instead of blocked */
export const MASKABLE_CATEGORIES = ["dlp_response", "dlp_prompt", "dlp"];

/** Categories that always require full block */
export const ALWAYS_BLOCK_CATEGORIES = [
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

// ── Exported helpers ─────────────────────────────────────────────

/** Build user-friendly block message from scan result */
export function buildBlockMessage(result: ScanResult): string {
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

/** Determine if result should be masked vs blocked */
export function shouldMaskOnly(result: ScanResult, dlpMaskOnly: boolean): boolean {
  if (!dlpMaskOnly) return false;

  // Any always-block category forces a full block
  const hasBlockingCategory = result.categories.some((cat) =>
    ALWAYS_BLOCK_CATEGORIES.includes(cat)
  );
  if (hasBlockingCategory) return false;

  // All categories must be maskable (or benign)
  const allMaskable = result.categories.every(
    (cat) => MASKABLE_CATEGORIES.includes(cat) || cat === "safe" || cat === "benign"
  );

  return allMaskable;
}

// ── Config helper ────────────────────────────────────────────────

function getConfig(ctx: any): {
  profileName: string;
  appName: string;
  failClosed: boolean;
  dlpMaskOnly: boolean;
} {
  const cfg: PrismaAirsConfig | undefined = ctx.cfg?.plugins?.entries?.["prisma-airs"]?.config;
  return {
    profileName: cfg?.profile_name ?? "default",
    appName: cfg?.app_name ?? "openclaw",
    failClosed: cfg?.fail_closed ?? true,
    dlpMaskOnly: cfg?.dlp_mask_only ?? true,
  };
}

// ── Registration ─────────────────────────────────────────────────

export function registerOutboundHooks(api: PluginApi, _hookCtx: HookCtxFn): number {
  // 1. message_sending — scan outbound response, DLP mask or full block
  api.on(
    "message_sending",
    async (event: MessageSendingEvent, ctx: any): Promise<MessageSendingResult | void> => {
      const config = getConfig(ctx);

      const content = event.content;
      if (!content || typeof content !== "string" || content.trim().length === 0) {
        return;
      }

      const sessionKey = event.metadata?.sessionKey || ctx.conversationId || "unknown";

      let result: ScanResult;

      try {
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

        if (config.failClosed) {
          return {
            content:
              "I apologize, but I'm unable to provide a response at this time due to a security verification issue. Please try again.",
          };
        }

        return; // fail-open
      }

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

      // Pass through when AIRS explicitly allows
      if (result.action === "allow") {
        return;
      }

      // DLP-only violation: mask instead of block
      if (shouldMaskOnly(result, config.dlpMaskOnly)) {
        const maskedContent = maskSensitiveData(content);

        if (maskedContent !== content) {
          console.log(
            JSON.stringify({
              event: "prisma_airs_outbound_mask",
              timestamp: new Date().toISOString(),
              sessionKey,
              action: result.action,
              categories: result.categories,
              scanId: result.scanId,
            })
          );

          return { content: maskedContent };
        }
      }

      // Full block — replace content entirely
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

      return { content: buildBlockMessage(result) };
    }
  );

  // 2. before_message_write (assistant role only) — hard block unless "allow"
  api.on(
    "before_message_write",
    async (event: MessageWriteEvent, ctx: any): Promise<MessageWriteResult | void> => {
      // Only scan assistant messages — user messages handled by inbound hook
      if (event.role !== "assistant") {
        return;
      }

      const config = getConfig(ctx);

      const content = event.content;
      if (!content || typeof content !== "string" || content.trim().length === 0) {
        return;
      }

      const sessionKey = event.metadata?.sessionKey || ctx.conversationId || "unknown";

      try {
        const result = await scan({
          response: content,
          profileName: config.profileName,
          appName: config.appName,
        });

        console.log(
          JSON.stringify({
            event: "prisma_airs_outbound_block_scan",
            timestamp: new Date().toISOString(),
            sessionKey,
            action: result.action,
            severity: result.severity,
            categories: result.categories,
            scanId: result.scanId,
            latencyMs: result.latencyMs,
          })
        );

        if (result.action === "allow") {
          return;
        }

        // Block — message will not be persisted
        console.log(
          JSON.stringify({
            event: "prisma_airs_outbound_block_rejected",
            timestamp: new Date().toISOString(),
            sessionKey,
            action: result.action,
            severity: result.severity,
            categories: result.categories,
            scanId: result.scanId,
            reportId: result.reportId,
          })
        );

        return { block: true };
      } catch (err) {
        console.error(
          JSON.stringify({
            event: "prisma_airs_outbound_block_error",
            timestamp: new Date().toISOString(),
            sessionKey,
            error: err instanceof Error ? err.message : String(err),
          })
        );

        if (config.failClosed) {
          return { block: true };
        }

        return; // fail-open
      }
    }
  );

  return 2;
}
