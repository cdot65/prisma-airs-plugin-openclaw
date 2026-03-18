/**
 * Prisma AIRS Tool Output Audit (after_tool_call)
 *
 * Fire-and-forget hook that scans tool execution results through AIRS.
 * Provides audit trail of tool output threats — complements tool-guard (pre-execution).
 */

import { scan, type ScanResult } from "../../src/scanner";

interface AfterToolCallEvent {
  toolName: string;
  params: Record<string, unknown>;
  runId?: string;
  toolCallId?: string;
  result?: unknown;
  error?: string;
  durationMs?: number;
}

interface HookContext {
  agentId?: string;
  sessionKey?: string;
  sessionId?: string;
  cfg?: {
    plugins?: {
      entries?: {
        "prisma-airs"?: {
          config?: {
            profile_name?: string;
            app_name?: string;
            tool_audit_mode?: string;
          };
        };
      };
    };
  };
}

/**
 * Serialize tool result to string for scanning
 */
function serializeResult(result: unknown): string | undefined {
  if (result === undefined || result === null) return undefined;
  if (typeof result === "string") return result;
  try {
    return JSON.stringify(result);
  } catch {
    return String(result);
  }
}

/**
 * Main hook handler — fire-and-forget audit of tool outputs
 */
const handler = async (event: AfterToolCallEvent, ctx: HookContext): Promise<void> => {
  const cfg = ctx.cfg?.plugins?.entries?.["prisma-airs"]?.config;
  const mode = cfg?.tool_audit_mode ?? "deterministic";

  if (mode === "off") return;

  // Serialize tool result
  const resultStr = serializeResult(event.result);
  if (!resultStr || !resultStr.trim()) return;

  const profileName = cfg?.profile_name ?? "default";
  const appName = cfg?.app_name ?? "openclaw";
  const sessionKey = ctx.sessionKey ?? "unknown";

  let scanResult: ScanResult;
  try {
    scanResult = await scan({
      response: resultStr,
      profileName,
      appName,
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
};

export default handler;
