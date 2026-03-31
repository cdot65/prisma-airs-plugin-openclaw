/**
 * Tool Protection Hook Group
 *
 * Merges four tool lifecycle hooks into a single registration function:
 *   1. before_tool_call  — cache-based gating (no API call)
 *   2. before_tool_call  — active AIRS scan of tool inputs
 *   3. tool_result_persist — synchronous regex DLP masking
 *   4. after_tool_call   — fire-and-forget audit scan of outputs
 */

import { scan, type ScanResult } from "../../src/scanner.ts";
import { getCachedScanResult } from "../../src/scan-cache.ts";
import { maskSensitiveData } from "../../src/dlp.ts";
import type { PrismaAirsConfig } from "../../src/config.ts";

// ── Shared types ───────────────────────────────────────────────────

interface PluginApi {
  on: (event: string, handler: (...args: any[]) => any) => void;
  logger: { info: (msg: string) => void; debug: (msg: string) => void };
}

interface HookCtxFn {
  (ctx: any): any;
}

interface BeforeToolCallEvent {
  toolName: string;
  toolId?: string;
  serverName?: string;
  params?: Record<string, unknown>;
}

interface ContentItem {
  type: string;
  text?: string;
  [key: string]: any;
}

interface ToolResultMessage {
  role?: string;
  toolCallId?: string;
  toolName?: string;
  content?: ContentItem[];
  isError?: boolean;
  timestamp?: number;
}

interface ToolResultPersistEvent {
  toolName?: string;
  toolCallId?: string;
  message: ToolResultMessage;
  isSynthetic?: boolean;
}

interface AfterToolCallEvent {
  toolName: string;
  params: Record<string, unknown>;
  runId?: string;
  toolCallId?: string;
  result?: unknown;
  error?: string;
  durationMs?: number;
}

interface HookResult {
  params?: Record<string, unknown>;
  block?: boolean;
  blockReason?: string;
}

interface ToolResultHookResult {
  message?: ToolResultMessage;
}

// ── Tool blocking maps ─────────────────────────────────────────────

const ALL_EXTERNAL_TOOLS = [
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
];
const DB_TOOLS = ["exec", "Bash", "bash", "database", "query", "sql", "eval"];
const CODE_TOOLS = [
  "exec",
  "Bash",
  "bash",
  "write",
  "Write",
  "edit",
  "Edit",
  "eval",
  "NotebookEdit",
];
const SENSITIVE_TOOLS = ["exec", "Bash", "bash", "gateway", "message", "cron"];
const WEB_TOOLS = ["web_fetch", "WebFetch", "browser", "Browser", "curl"];

/** Category-to-tool blocking rules */
export const TOOL_BLOCKS: Record<string, string[]> = {
  // AI Agent threats — block ALL external actions
  "agent-threat": ALL_EXTERNAL_TOOLS,
  agent_threat: ALL_EXTERNAL_TOOLS,
  agent_threat_prompt: ALL_EXTERNAL_TOOLS,
  agent_threat_response: ALL_EXTERNAL_TOOLS,

  // SQL/Database injection — block database and exec tools
  "sql-injection": DB_TOOLS,
  db_security: DB_TOOLS,
  "db-security": DB_TOOLS,
  db_security_response: DB_TOOLS,

  // Malicious code — block code execution and file writes
  "malicious-code": CODE_TOOLS,
  malicious_code: CODE_TOOLS,
  malicious_code_prompt: CODE_TOOLS,
  malicious_code_response: CODE_TOOLS,

  // Prompt injection — block sensitive tools
  "prompt-injection": SENSITIVE_TOOLS,
  prompt_injection: SENSITIVE_TOOLS,

  // Malicious URLs — block web access
  "malicious-url": WEB_TOOLS,
  malicious_url: WEB_TOOLS,
  url_filtering_prompt: WEB_TOOLS,
  url_filtering_response: WEB_TOOLS,

  // Toxic content — block code/write tools
  toxic_content: CODE_TOOLS,
  toxic_content_prompt: CODE_TOOLS,
  toxic_content_response: CODE_TOOLS,

  // Topic violations — block sensitive tools
  topic_violation: SENSITIVE_TOOLS,
  topic_violation_prompt: SENSITIVE_TOOLS,
  topic_violation_response: SENSITIVE_TOOLS,

  // Scan failure — block sensitive tools + write/edit
  "scan-failure": SENSITIVE_TOOLS.concat(["write", "Write", "edit", "Edit"]),
};

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Determine if a tool should be blocked based on scan result categories.
 * No configurable high_risk_tools — blocking is purely category-based.
 */
export function shouldBlockTool(
  toolName: string,
  scanResult: ScanResult
): { block: boolean; reason: string } {
  const blockedTools = new Set<string>();

  for (const category of scanResult.categories) {
    const tools = TOOL_BLOCKS[category];
    if (tools) {
      tools.forEach((t) => blockedTools.add(t.toLowerCase()));
    }
  }

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

/** Serialize tool result to string for scanning */
function serializeResult(result: unknown): string | undefined {
  if (result === undefined || result === null) return undefined;
  if (typeof result === "string") return result;
  try {
    return JSON.stringify(result);
  } catch {
    return String(result);
  }
}

// ── Config helper ───────────────────────────────────────────────────

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

// ── Registration ────────────────────────────────────────────────────

export function registerToolProtectionHooks(api: PluginApi, _hookCtx: HookCtxFn): number {
  // ─── 1. before_tool_call — cache-based gating (fast, no API call) ───

  api.on(
    "before_tool_call",
    async (event: BeforeToolCallEvent, ctx: any): Promise<HookResult | void> => {
      const toolName = event.toolName;
      if (!toolName) return;

      const sessionKey = ctx.sessionKey || ctx.conversationId || "unknown";

      // Get cached scan result from inbound scanning
      const scanResult = getCachedScanResult(sessionKey);
      if (!scanResult) return; // No cached result, allow through

      // Safe message — allow all tools
      if (
        scanResult.action === "allow" &&
        (scanResult.severity === "SAFE" ||
          scanResult.categories.every((c) => c === "safe" || c === "benign"))
      ) {
        return;
      }

      const { block, reason } = shouldBlockTool(toolName, scanResult);

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

        return { block: true, blockReason: reason };
      }

      // Tool allowed despite active warning — log for audit
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
    }
  );

  // ─── 2. before_tool_call — active AIRS scan of tool inputs ──────────

  api.on(
    "before_tool_call",
    async (event: BeforeToolCallEvent, ctx: any): Promise<HookResult | void> => {
      if (!event.toolName) return;

      const config = getConfig(ctx);
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
        if (result.action === "allow") return;

        const categories = result.categories
          .filter((c) => c !== "safe" && c !== "benign")
          .join(", ");

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

        // Fail-closed blocks on error
        if (config.failClosed) {
          return {
            block: true,
            blockReason: `Tool '${event.toolName}' blocked: security scan failed. Try again later.`,
          };
        }

        return;
      }
    }
  );

  // ─── 3. tool_result_persist — synchronous regex DLP masking ─────────

  api.on(
    "tool_result_persist",
    (event: ToolResultPersistEvent, ctx: any): ToolResultHookResult | void => {
      // Skip synthetic results (generated by guard/repair steps)
      if (event.isSynthetic) return;

      const message = event.message;
      if (!message?.content || !Array.isArray(message.content) || message.content.length === 0) {
        return;
      }

      // Check scan cache for AIRS DLP signal
      const sessionKey = ctx.sessionKey ?? "unknown";
      const cached: ScanResult | undefined = getCachedScanResult(sessionKey);
      const hasDlpSignal = cached?.responseDetected?.dlp === true;

      // Process each content item
      let anyChanged = false;
      const newContent: ContentItem[] = message.content.map((item: ContentItem) => {
        if (item.type !== "text" || typeof item.text !== "string") return item;

        const masked = maskSensitiveData(item.text);
        if (masked !== item.text) {
          anyChanged = true;
          return { ...item, text: masked };
        }

        return item;
      });

      if (!anyChanged) return;

      const action = hasDlpSignal ? "cache_dlp" : "regex";

      console.log(
        JSON.stringify({
          event: "prisma_airs_tool_redact",
          timestamp: new Date().toISOString(),
          sessionKey,
          toolName: event.toolName ?? message.toolName ?? "unknown",
          action,
          cachedDlp: hasDlpSignal,
        })
      );

      return { message: { ...message, content: newContent } };
    }
  );

  // ─── 4. after_tool_call — fire-and-forget audit scan ────────────────

  api.on("after_tool_call", async (event: AfterToolCallEvent, ctx: any): Promise<void> => {
    const config = getConfig(ctx);
    const sessionKey = ctx.sessionKey ?? "unknown";

    // Serialize tool result
    const resultStr = serializeResult(event.result);
    if (!resultStr || !resultStr.trim()) return;

    let scanResult: ScanResult;
    try {
      scanResult = await scan({
        response: resultStr,
        profileName: config.profileName,
        appName: config.appName,
        toolEvents: [
          {
            metadata: {
              ecosystem: "mcp",
              method: "tool_result",
              serverName: "local",
              toolInvoked: event.toolName,
            },
            input: resultStr,
          },
        ],
      });
    } catch (err) {
      console.error(
        JSON.stringify({
          event: "prisma_airs_tool_output_error",
          timestamp: new Date().toISOString(),
          sessionKey,
          toolName: event.toolName,
          error: err instanceof Error ? err.message : String(err),
        })
      );
      return;
    }

    console.log(
      JSON.stringify({
        event: "prisma_airs_tool_output_audit",
        timestamp: new Date().toISOString(),
        sessionKey,
        toolName: event.toolName,
        durationMs: event.durationMs,
        action: scanResult.action,
        severity: scanResult.severity,
        categories: scanResult.categories,
        scanId: scanResult.scanId,
        reportId: scanResult.reportId,
        latencyMs: scanResult.latencyMs,
        responseDetected: scanResult.responseDetected,
      })
    );
  });

  return 4;
}
