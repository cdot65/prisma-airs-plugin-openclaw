/**
 * Prisma AIRS Audit Logger (message_received)
 *
 * Fire-and-forget audit logging of inbound messages.
 * Cannot block - only logs scan results and caches for downstream hooks.
 */

import { scan, defaultPromptDetected, defaultResponseDetected } from "../../src/scanner";
import { cacheScanResult, hashMessage } from "../../src/scan-cache";

// Event shape from OpenClaw message_received hook
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

// Context passed to hook
interface HookContext {
  channelId?: string;
  accountId?: string;
  conversationId?: string;
}

// Plugin config structure
interface PluginConfig {
  plugins?: {
    entries?: {
      "prisma-airs"?: {
        config?: {
          audit_enabled?: boolean;
          profile_name?: string;
          app_name?: string;
          api_key?: string;
          fail_closed?: boolean;
        };
      };
    };
  };
}

/**
 * Get plugin configuration
 */
function getPluginConfig(ctx: HookContext & { cfg?: PluginConfig }): {
  enabled: boolean;
  profileName: string;
  appName: string;
  apiKey: string;
  failClosed: boolean;
} {
  const cfg = ctx.cfg?.plugins?.entries?.["prisma-airs"]?.config;
  return {
    enabled: cfg?.audit_enabled !== false,
    profileName: cfg?.profile_name ?? "default",
    appName: cfg?.app_name ?? "openclaw",
    apiKey: cfg?.api_key ?? "",
    failClosed: cfg?.fail_closed ?? true, // Default fail-closed
  };
}

/**
 * Main hook handler
 */
const handler = async (
  event: MessageReceivedEvent,
  ctx: HookContext & { cfg?: PluginConfig }
): Promise<void> => {
  const config = getPluginConfig(ctx);

  // Check if audit is enabled
  if (!config.enabled) {
    return;
  }

  // Validate we have content to scan
  const content = event.content;
  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return;
  }

  // Build session key for caching
  // Use conversationId or fallback to sender + channel
  const sessionKey =
    ctx.conversationId || `${event.from || "unknown"}_${ctx.channelId || "unknown"}`;

  try {
    // Scan the inbound message
    const result = await scan({
      prompt: content,
      profileName: config.profileName,
      appName: config.appName,
      apiKey: config.apiKey,
      appUser: event.metadata?.senderId || event.from,
    });

    // Cache result for downstream hooks (before_agent_start, before_tool_call)
    const msgHash = hashMessage(content);
    cacheScanResult(sessionKey, result, msgHash);

    // Audit log
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
      })
    );
  } catch (err) {
    // Log error but don't throw - this is fire-and-forget
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

    // If fail-closed, cache a synthetic "block" result
    // This ensures downstream hooks block on scan failure
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
};

export default handler;
