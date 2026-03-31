/**
 * Tool Input Guard Hook
 *
 * Scans tool inputs via AIRS before the tool executes.
 * Blocks execution unless AIRS returns action === "allow".
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

function getConfig(ctx: any): { profileName: string; appName: string; failClosed: boolean } {
  const cfg: PrismaAirsConfig | undefined = ctx.cfg?.plugins?.entries?.["prisma-airs"]?.config;
  return {
    profileName: cfg?.profile_name ?? "default",
    appName: cfg?.app_name ?? "openclaw",
    failClosed: cfg?.fail_closed ?? true,
  };
}

export function registerToolInputGuardHooks(api: PluginApi, hookCtx: HookCtxFn): number {
  api.on(
    "before_tool_call",
    async (event: any, ctx: any): Promise<{ block?: boolean; blockReason?: string } | void> => {
      if (!event.toolName) return;
      const config = getConfig(hookCtx(ctx));
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
            event: "prisma_airs_tool_input_guard_scan",
            timestamp: new Date().toISOString(),
            sessionKey,
            toolName: event.toolName,
            toolId: event.toolId,
            action: result.action,
            severity: result.severity,
            categories: result.categories,
            scanId: result.scanId,
            latencyMs: result.latencyMs,
            ...(result.hasError && { hasError: result.hasError, error: result.error }),
          })
        );
        if (result.action === "allow") return;

        // API error returned as result (not thrown) — respect fail_closed
        if (result.hasError && result.categories.includes("api_error")) {
          if (config.failClosed) {
            return {
              block: true,
              blockReason: `Tool '${event.toolName}' blocked: security scan failed (${result.error || "unknown error"}). Try again later.`,
            };
          }
          return;
        }

        const categories = result.categories
          .filter((c) => c !== "safe" && c !== "benign")
          .join(", ");
        console.log(
          JSON.stringify({
            event: "prisma_airs_tool_input_guard_block",
            timestamp: new Date().toISOString(),
            sessionKey,
            toolName: event.toolName,
            action: result.action,
            categories: result.categories,
            scanId: result.scanId,
            reportId: result.reportId,
          })
        );
        return {
          block: true,
          blockReason: `Tool '${event.toolName}' blocked by security scan: ${categories || "threat detected"}. Scan ID: ${result.scanId || "N/A"}`,
        };
      } catch (err) {
        console.error(
          JSON.stringify({
            event: "prisma_airs_tool_input_guard_error",
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
        return;
      }
    }
  );
  return 1;
}
