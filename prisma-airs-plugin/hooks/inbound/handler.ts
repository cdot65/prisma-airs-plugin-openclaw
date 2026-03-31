/**
 * Inbound Scanning Hook Group
 *
 * Merges audit (message_received) and inbound-block (before_message_write)
 * into a single registration function.
 */

import { scan, defaultPromptDetected, defaultResponseDetected } from "../../src/scanner.ts";
import { cacheScanResult, hashMessage } from "../../src/scan-cache.ts";
import type { PrismaAirsConfig } from "../../src/config.ts";

// ── Shared types ───────────────────────────────────────────────────

interface PluginApi {
  on: (event: string, handler: (...args: any[]) => any) => void;
  logger: { info: (msg: string) => void; debug: (msg: string) => void };
}

interface HookCtxFn {
  (ctx: any): any;
}

interface MessageReceivedEvent {
  from: string;
  content: string;
  timestamp?: number;
  metadata?: {
    to?: string;
    provider?: string;
    surface?: string;
    threadId?: string;
    originatingChannel?: string;
    originatingTo?: string;
    messageId?: string;
    senderId?: string;
    senderName?: string;
    senderUsername?: string;
    senderE164?: string;
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

// ── Config helper ──────────────────────────────────────────────────

function getConfig(ctx: any): {
  profileName: string;
  appName: string;
  failClosed: boolean;
} {
  const cfg: PrismaAirsConfig | undefined = ctx.cfg?.plugins?.entries?.["prisma-airs"]?.config;
  return {
    profileName: cfg?.profile_name ?? "default",
    appName: cfg?.app_name ?? "openclaw",
    failClosed: cfg?.fail_closed ?? true,
  };
}

// ── Registration ───────────────────────────────────────────────────

export function registerInboundHooks(api: PluginApi, hookCtx: HookCtxFn): number {
  // 1. message_received — fire-and-forget audit scan
  api.on("message_received", async (event: MessageReceivedEvent, ctx: any) => {
    const config = getConfig(hookCtx(ctx));

    const content = event.content;
    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return;
    }

    const sessionKey =
      ctx.conversationId || `${event.from || "unknown"}_${ctx.channelId || "unknown"}`;

    try {
      const result = await scan({
        prompt: content,
        profileName: config.profileName,
        appName: config.appName,
        appUser: event.metadata?.senderId || event.from,
      });

      const msgHash = hashMessage(content);
      cacheScanResult(sessionKey, result, msgHash);

      console.log(
        JSON.stringify({
          event: "prisma_airs_inbound_scan",
          timestamp: new Date().toISOString(),
          sessionKey,
          senderId: event.metadata?.senderId || event.from,
          senderName: event.metadata?.senderName,
          channel: ctx.channelId,
          provider: event.metadata?.provider,
          messageId: event.metadata?.messageId,
          action: result.action,
          severity: result.severity,
          categories: result.categories,
          scanId: result.scanId,
          reportId: result.reportId,
          latencyMs: result.latencyMs,
          promptDetected: result.promptDetected,
          ...(result.hasError && { hasError: result.hasError, error: result.error }),
        })
      );
    } catch (err) {
      console.error(
        JSON.stringify({
          event: "prisma_airs_inbound_scan_error",
          timestamp: new Date().toISOString(),
          sessionKey,
          senderId: event.metadata?.senderId || event.from,
          channel: ctx.channelId,
          error: err instanceof Error ? err.message : String(err),
        })
      );

      if (config.failClosed) {
        const msgHash = hashMessage(content);
        cacheScanResult(
          sessionKey,
          {
            action: "block",
            severity: "CRITICAL",
            categories: ["scan-failure"],
            scanId: "",
            reportId: "",
            profileName: config.profileName,
            promptDetected: defaultPromptDetected(),
            responseDetected: defaultResponseDetected(),
            latencyMs: 0,
            timeout: false,
            hasError: true,
            contentErrors: [],
            error: `Scan failed: ${err instanceof Error ? err.message : String(err)}`,
          },
          msgHash
        );
      }
    }
  });

  // 2. before_message_write — hard block for user messages
  api.on("before_message_write", async (event: MessageWriteEvent, ctx: any) => {
    // Only scan user messages
    if (event.role !== "user") {
      return;
    }

    const config = getConfig(hookCtx(ctx));

    const content = event.content;
    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return;
    }

    const sessionKey = event.metadata?.sessionKey || ctx.conversationId || "unknown";

    try {
      const result = await scan({
        prompt: content,
        profileName: config.profileName,
        appName: config.appName,
      });

      console.log(
        JSON.stringify({
          event: "prisma_airs_inbound_block_scan",
          timestamp: new Date().toISOString(),
          sessionKey,
          action: result.action,
          severity: result.severity,
          categories: result.categories,
          scanId: result.scanId,
          latencyMs: result.latencyMs,
          ...(result.hasError && { hasError: result.hasError, error: result.error }),
        })
      );

      if (result.action === "allow") {
        return;
      }

      console.log(
        JSON.stringify({
          event: "prisma_airs_inbound_block_rejected",
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
          event: "prisma_airs_inbound_block_error",
          timestamp: new Date().toISOString(),
          sessionKey,
          error: err instanceof Error ? err.message : String(err),
        })
      );

      if (config.failClosed) {
        return { block: true };
      }

      return;
    }
  });

  return 2;
}
