/**
 * Prisma AIRS Tool Gating (before_tool_call)
 *
 * Blocks dangerous tool calls when security warnings are active.
 * CAN BLOCK via { block: true, blockReason: "..." }
 */

import { getCachedScanResult } from "../../src/scan-cache";
import type { ScanResult } from "../../src/scanner";

// Event shape from OpenClaw before_tool_call hook
interface BeforeToolCallEvent {
  toolName: string;
  toolId?: string;
  params?: Record<string, unknown>;
}

// Context passed to hook
interface HookContext {
  sessionKey?: string;
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
          tool_gating_enabled?: boolean;
          high_risk_tools?: string[];
        };
      };
    };
  };
}

// Hook result type
interface HookResult {
  params?: Record<string, unknown>;
  block?: boolean;
  blockReason?: string;
}

// Tool blocking rules by threat category
const TOOL_BLOCKS: Record<string, string[]> = {
  // AI Agent threats - block ALL external actions
  "agent-threat": [
    "exec",
    "Bash",
    "bash",
    "write",
    "Write",
    "edit",
    "Edit",
    "gateway",
    "message",
    "cron",
    "browser",
    "web_fetch",
    "WebFetch",
    "database",
    "query",
    "sql",
    "eval",
    "NotebookEdit",
  ],

  // SQL/Database injection - block database and exec tools
  "sql-injection": ["exec", "Bash", "bash", "database", "query", "sql", "eval"],
  db_security: ["exec", "Bash", "bash", "database", "query", "sql", "eval"],
  "db-security": ["exec", "Bash", "bash", "database", "query", "sql", "eval"],

  // Malicious code - block code execution and file writes
  "malicious-code": [
    "exec",
    "Bash",
    "bash",
    "write",
    "Write",
    "edit",
    "Edit",
    "eval",
    "NotebookEdit",
  ],
  malicious_code: [
    "exec",
    "Bash",
    "bash",
    "write",
    "Write",
    "edit",
    "Edit",
    "eval",
    "NotebookEdit",
  ],

  // Prompt injection - block sensitive tools
  "prompt-injection": ["exec", "Bash", "bash", "gateway", "message", "cron"],
  prompt_injection: ["exec", "Bash", "bash", "gateway", "message", "cron"],

  // Malicious URLs - block web access
  "malicious-url": ["web_fetch", "WebFetch", "browser", "Browser", "curl"],
  malicious_url: ["web_fetch", "WebFetch", "browser", "Browser", "curl"],
  url_filtering_prompt: ["web_fetch", "WebFetch", "browser", "Browser", "curl"],

  // Scan failure - block high-risk tools
  "scan-failure": [
    "exec",
    "Bash",
    "bash",
    "write",
    "Write",
    "edit",
    "Edit",
    "gateway",
    "message",
    "cron",
  ],
};

// Default high-risk tools (blocked on any threat)
const DEFAULT_HIGH_RISK_TOOLS = [
  "exec",
  "Bash",
  "bash",
  "write",
  "Write",
  "edit",
  "Edit",
  "gateway",
  "message",
  "cron",
];

/**
 * Get plugin configuration
 */
function getPluginConfig(ctx: HookContext): {
  enabled: boolean;
  highRiskTools: string[];
} {
  const cfg = ctx.cfg?.plugins?.entries?.["prisma-airs"]?.config;
  return {
    enabled: cfg?.tool_gating_enabled !== false,
    highRiskTools: cfg?.high_risk_tools ?? DEFAULT_HIGH_RISK_TOOLS,
  };
}

/**
 * Determine if a tool should be blocked based on scan result
 */
function shouldBlockTool(
  toolName: string,
  scanResult: ScanResult,
  highRiskTools: string[]
): { block: boolean; reason: string } {
  // Collect all tools that should be blocked based on detected categories
  const blockedTools = new Set<string>();

  for (const category of scanResult.categories) {
    const tools = TOOL_BLOCKS[category];
    if (tools) {
      tools.forEach((t) => blockedTools.add(t.toLowerCase()));
    }
  }

  // Add high-risk tools if any threat was detected
  const hasThreat =
    scanResult.action === "block" ||
    scanResult.action === "warn" ||
    (scanResult.categories.length > 0 &&
      !scanResult.categories.every((c) => c === "safe" || c === "benign"));

  if (hasThreat) {
    highRiskTools.forEach((t) => blockedTools.add(t.toLowerCase()));
  }

  // Check if this tool should be blocked
  const toolLower = toolName.toLowerCase();
  if (blockedTools.has(toolLower)) {
    const threatCategories = scanResult.categories
      .filter((c) => c !== "safe" && c !== "benign")
      .join(", ");

    return {
      block: true,
      reason:
        `Tool '${toolName}' blocked due to security threat: ${threatCategories || "unknown"}. ` +
        `Scan ID: ${scanResult.scanId || "N/A"}`,
    };
  }

  return { block: false, reason: "" };
}

/**
 * Main hook handler
 */
const handler = async (
  event: BeforeToolCallEvent,
  ctx: HookContext
): Promise<HookResult | void> => {
  const config = getPluginConfig(ctx);

  // Check if tool gating is enabled
  if (!config.enabled) {
    return;
  }

  // Get tool name
  const toolName = event.toolName;
  if (!toolName) {
    return;
  }

  // Build session key
  const sessionKey = ctx.sessionKey || ctx.conversationId || "unknown";

  // Get cached scan result from inbound scanning
  const scanResult = getCachedScanResult(sessionKey);
  if (!scanResult) {
    return; // No scan result cached, allow through
  }

  // Check if result indicates a safe message
  if (
    scanResult.action === "allow" &&
    (scanResult.severity === "SAFE" ||
      scanResult.categories.every((c) => c === "safe" || c === "benign"))
  ) {
    return; // Safe, allow all tools
  }

  // Check if this tool should be blocked
  const { block, reason } = shouldBlockTool(toolName, scanResult, config.highRiskTools);

  if (block) {
    console.log(
      JSON.stringify({
        event: "prisma_airs_tool_block",
        timestamp: new Date().toISOString(),
        sessionKey,
        toolName,
        toolId: event.toolId,
        scanAction: scanResult.action,
        severity: scanResult.severity,
        categories: scanResult.categories,
        scanId: scanResult.scanId,
      })
    );

    return {
      block: true,
      blockReason: reason,
    };
  }

  // Tool allowed, log for audit
  if (scanResult.action !== "allow") {
    console.log(
      JSON.stringify({
        event: "prisma_airs_tool_allow",
        timestamp: new Date().toISOString(),
        sessionKey,
        toolName,
        toolId: event.toolId,
        note: "Tool allowed despite active security warning",
        scanAction: scanResult.action,
        categories: scanResult.categories,
      })
    );
  }
};

export default handler;
