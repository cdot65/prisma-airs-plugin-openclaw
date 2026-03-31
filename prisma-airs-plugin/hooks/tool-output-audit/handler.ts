/**
 * Tool Output Audit Hook
 *
 * Fire-and-forget AIRS scan of tool outputs.
 * Logs audit data but cannot block (after_tool_call is async void).
 */

import { scan } from "../../src/scanner.ts";
import type { PrismaAirsConfig } from "../../src/config.ts";

interface PluginApi {
  on: (event: string, handler: (...args: any[]) => any) => void;
  logger: { info: (msg: string) => void; debug: (msg: string) => void };
}

interface HookCtxFn {
  (ctx: any): any;
}

function getConfig(ctx: any): { profileName: string; appName: string } {
  const cfg: PrismaAirsConfig | undefined = ctx.cfg?.plugins?.entries?.["prisma-airs"]?.config;
  return {
    profileName: cfg?.profile_name ?? "default",
    appName: cfg?.app_name ?? "openclaw",
  };
}

function serializeResult(result: unknown): string | undefined {
  if (result === undefined || result === null) return undefined;
  if (typeof result === "string") return result;
  try {
    return JSON.stringify(result);
  } catch {
    return String(result);
  }
}

export function registerToolOutputAuditHooks(api: PluginApi, hookCtx: HookCtxFn): number {
  api.on("after_tool_call", async (event: any, ctx: any): Promise<void> => {
    const config = getConfig(hookCtx(ctx));
    const sessionKey = ctx.sessionKey ?? "unknown";
    const resultStr = serializeResult(event.result);
    if (!resultStr || !resultStr.trim()) return;

    try {
      const scanResult = await scan({
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
            output: resultStr,
          },
        ],
      });
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
          ...(scanResult.hasError && { hasError: scanResult.hasError, error: scanResult.error }),
        })
      );
    } catch (err) {
      console.error(
        JSON.stringify({
          event: "prisma_airs_tool_output_audit_error",
          timestamp: new Date().toISOString(),
          sessionKey,
          toolName: event.toolName,
          error: err instanceof Error ? err.message : String(err),
        })
      );
    }
  });
  return 1;
}
