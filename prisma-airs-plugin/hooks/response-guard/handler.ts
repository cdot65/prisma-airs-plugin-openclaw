/**
 * Response Guard Hook
 *
 * Scans assistant responses via AIRS before the user sees them.
 * Uses message_sending to replace content with a block message
 * or mask DLP-only violations.
 */

import { scan, type ScanResult } from "../../src/scanner.ts";
import { maskSensitiveData } from "../../src/dlp.ts";
import type { PrismaAirsConfig } from "../../src/config.ts";

interface PluginApi {
  on: (event: string, handler: (...args: any[]) => any) => void;
  logger: { info: (msg: string) => void; debug: (msg: string) => void };
}

interface HookCtxFn {
  (ctx: any): any;
}

const MASKABLE_CATEGORIES = ["dlp_response", "dlp_prompt", "dlp"];

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

function shouldMaskOnly(result: ScanResult, dlpMaskOnly: boolean): boolean {
  if (!dlpMaskOnly) return false;
  if (result.categories.some((cat) => ALWAYS_BLOCK_CATEGORIES.includes(cat))) return false;
  return result.categories.every(
    (cat) => MASKABLE_CATEGORIES.includes(cat) || cat === "safe" || cat === "benign"
  );
}

function buildBlockMessage(result: ScanResult): string {
  const reasons = result.categories
    .map((cat) => cat.replace(/_/g, " "))
    .filter((r) => r !== "safe" && r !== "benign")
    .join(", ");
  return (
    `I apologize, but I'm unable to provide that response due to security policy` +
    (reasons ? ` (${reasons})` : "") +
    `. Please rephrase your request or contact support if you believe this is an error.`
  );
}

export function registerResponseGuardHooks(api: PluginApi, hookCtx: HookCtxFn): number {
  api.on(
    "message_sending",
    async (event: any, ctx: any): Promise<{ content?: string; cancel?: boolean } | void> => {
      const config = getConfig(hookCtx(ctx));
      const content = event.content;
      if (!content || typeof content !== "string" || content.trim().length === 0) return;
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
            event: "prisma_airs_response_guard_error",
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
        return;
      }

      console.log(
        JSON.stringify({
          event: "prisma_airs_response_guard_scan",
          timestamp: new Date().toISOString(),
          sessionKey,
          action: result.action,
          severity: result.severity,
          categories: result.categories,
          scanId: result.scanId,
          reportId: result.reportId,
          latencyMs: result.latencyMs,
          ...(result.hasError && { hasError: result.hasError, error: result.error }),
        })
      );

      if (result.action === "allow") return;

      // API error returned as result (not thrown) — respect fail_closed
      if (result.hasError && result.categories.includes("api_error")) {
        if (config.failClosed) {
          return {
            content:
              "I apologize, but I'm unable to provide a response at this time due to a security verification issue. Please try again.",
          };
        }
        return;
      }

      if (shouldMaskOnly(result, config.dlpMaskOnly)) {
        const maskedContent = maskSensitiveData(content);
        if (maskedContent !== content) {
          console.log(
            JSON.stringify({
              event: "prisma_airs_response_guard_mask",
              timestamp: new Date().toISOString(),
              sessionKey,
              categories: result.categories,
              scanId: result.scanId,
            })
          );
          return { content: maskedContent };
        }
      }

      console.log(
        JSON.stringify({
          event: "prisma_airs_response_guard_block",
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
  return 1;
}
