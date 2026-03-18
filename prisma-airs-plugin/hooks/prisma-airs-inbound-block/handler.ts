/**
 * Prisma AIRS Inbound Blocking (before_message_write)
 *
 * Hard guardrail: blocks user messages unless AIRS returns action "allow".
 * Blocked messages are never persisted to conversation history.
 */

import { scan } from "../../src/scanner";

// Event shape from OpenClaw before_message_write hook
interface MessageWriteEvent {
  content?: string;
  role?: string;
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
          profile_name?: string;
          app_name?: string;
          fail_closed?: boolean;
          inbound_block_mode?: string;
        };
      };
    };
  };
}

// Hook result type
interface HookResult {
  block: boolean;
}

/**
 * Get plugin configuration
 */
function getPluginConfig(ctx: HookContext): {
  profileName: string;
  appName: string;
  failClosed: boolean;
  mode: string;
} {
  const cfg = ctx.cfg?.plugins?.entries?.["prisma-airs"]?.config;
  return {
    profileName: cfg?.profile_name ?? "default",
    appName: cfg?.app_name ?? "openclaw",
    failClosed: cfg?.fail_closed ?? true,
    mode: cfg?.inbound_block_mode ?? "deterministic",
  };
}

/**
 * Main hook handler
 */
const handler = async (event: MessageWriteEvent, ctx: HookContext): Promise<HookResult | void> => {
  const config = getPluginConfig(ctx);

  // Skip if disabled
  if (config.mode === "off") {
    return;
  }

  // Only scan user messages — assistant messages handled by outbound hook
  if (event.role !== "user") {
    return;
  }

  // Validate content
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

    // Log scan result
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
      })
    );

    // Only allow when AIRS explicitly says "allow"
    if (result.action === "allow") {
      return;
    }

    // Block — message will not be persisted
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

    // Fail-closed: block on scan failure
    if (config.failClosed) {
      return { block: true };
    }

    return; // Fail-open
  }
};

export default handler;
