/**
 * Prisma AIRS Tool Guard (before_tool_call)
 *
 * Actively scans tool call inputs through AIRS using the toolEvent content type.
 * Blocks tool execution unless AIRS returns action "allow".
 */

import { scan } from "../../src/scanner";

// Event shape from OpenClaw before_tool_call hook
interface BeforeToolCallEvent {
  toolName: string;
  toolId?: string;
  serverName?: string;
  params?: Record<string, unknown>;
}

// Context passed to hook
interface HookContext {
  sessionKey?: string;
  channelId?: string;
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
          tool_guard_mode?: string;
        };
      };
    };
  };
}

// Hook result type
interface HookResult {
  block?: boolean;
  blockReason?: string;
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
    mode: cfg?.tool_guard_mode ?? "deterministic",
  };
}

/**
 * Main hook handler
 */
const handler = async (
  event: BeforeToolCallEvent,
  ctx: HookContext
): Promise<HookResult | void> => {
  const config = getPluginConfig(ctx);

  // Skip if disabled
  if (config.mode === "off") {
    return;
  }

  // Validate tool name
  if (!event.toolName) {
    return;
  }

  const sessionKey = ctx.sessionKey || ctx.conversationId || "unknown";
  const inputStr = event.params ? JSON.stringify(event.params) : undefined;

  try {
    const result = await scan({
      profileName: config.profileName,
      appName: config.appName,
      toolEvents: [
        {
          metadata: {
            ecosystem: "mcp",
            method: "tool_call",
            serverName: event.serverName ?? "unknown",
            toolInvoked: event.toolName,
          },
          input: inputStr,
        },
      ],
    });

    // Log scan result
    console.log(
      JSON.stringify({
        event: "prisma_airs_tool_guard_scan",
        timestamp: new Date().toISOString(),
        sessionKey,
        toolName: event.toolName,
        toolId: event.toolId,
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

    // Block tool execution
    const categories = result.categories.filter((c) => c !== "safe" && c !== "benign").join(", ");

    console.log(
      JSON.stringify({
        event: "prisma_airs_tool_guard_block",
        timestamp: new Date().toISOString(),
        sessionKey,
        toolName: event.toolName,
        toolId: event.toolId,
        action: result.action,
        severity: result.severity,
        categories: result.categories,
        scanId: result.scanId,
        reportId: result.reportId,
      })
    );

    return {
      block: true,
      blockReason:
        `Tool '${event.toolName}' blocked by security scan: ${categories || "threat detected"}. ` +
        `Scan ID: ${result.scanId || "N/A"}`,
    };
  } catch (err) {
    console.error(
      JSON.stringify({
        event: "prisma_airs_tool_guard_error",
        timestamp: new Date().toISOString(),
        sessionKey,
        toolName: event.toolName,
        error: err instanceof Error ? err.message : String(err),
      })
    );

    if (config.failClosed) {
      return {
        block: true,
        blockReason: `Tool '${event.toolName}' blocked: security scan failed. Try again later.`,
      };
    }

    return; // Fail-open
  }
};

export default handler;
