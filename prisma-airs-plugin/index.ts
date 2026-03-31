/**
 * Prisma AIRS Plugin for OpenClaw (v2.1.0)
 *
 * AI Runtime Security via Palo Alto Networks.
 *
 * 3 hook groups, boolean-gated:
 * - prompt_scanning: scan + block inbound prompts
 * - response_scanning: scan + mask/block outbound responses
 * - tool_protection: guard, redact, and audit tool I/O
 *
 * Plus: prisma_airs_scan tool (always), gateway RPC, CLI.
 */

import { init } from "@cdot65/prisma-airs-sdk";
import { scan, isConfigured, type ScanRequest } from "./src/scanner";
import { resolveConfig, type PrismaAirsConfig } from "./src/config";

import { registerPromptGuardHooks } from "./hooks/prompt-guard/handler";
import { registerResponseGuardHooks } from "./hooks/response-guard/handler";
import { registerToolInputGuardHooks } from "./hooks/tool-input-guard/handler";
import { registerToolOutputAuditHooks } from "./hooks/tool-output-audit/handler";

// Tool parameter schema
interface ToolParameterProperty {
  type: string;
  description: string;
  items?: { type: string };
}

interface ToolParameters {
  type: "object";
  properties: Record<string, ToolParameterProperty>;
  required?: string[];
}

interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
}

interface PluginApi {
  logger: {
    info: (msg: string) => void;
    debug: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
  config: {
    plugins?: {
      entries?: {
        "prisma-airs"?: {
          config?: Record<string, unknown>;
        };
      };
    };
  };
  on: (event: string, handler: (...args: any[]) => any, opts?: { priority?: number }) => void;
  registerGatewayMethod: (
    name: string,
    handler: (
      ctx: { respond: (ok: boolean, data: unknown) => void },
      params?: ScanRequest
    ) => void | Promise<void>
  ) => void;
  registerTool: (tool: {
    name: string;
    description: string;
    parameters: ToolParameters;
    execute: (_id: string, params: Record<string, unknown>) => Promise<ToolResult>;
  }) => void;
  registerCli: (setup: (ctx: { program: unknown }) => void, opts: { commands: string[] }) => void;
}

function getRawConfig(api: PluginApi): Record<string, unknown> {
  return (api.config?.plugins?.entries?.["prisma-airs"]?.config as Record<string, unknown>) ?? {};
}

function buildScanRequest(params: ScanRequest | undefined, config: PrismaAirsConfig): ScanRequest {
  return {
    prompt: params?.prompt,
    response: params?.response,
    sessionId: params?.sessionId,
    trId: params?.trId,
    profileName: params?.profileName ?? config.profile_name,
    appName: params?.appName ?? config.app_name ?? "openclaw",
    appUser: params?.appUser,
    aiModel: params?.aiModel,
  };
}

function textResult(data: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

// ── Plugin registration ───────────────────────────────────────────────

export default function register(api: PluginApi): void {
  const raw = getRawConfig(api);
  const config = resolveConfig(raw);

  // Initialize SDK
  if (config.api_key) {
    init({ apiKey: config.api_key });
  } else {
    api.logger.warn("Prisma AIRS: no API key configured. Scans will fail until key is set.");
  }

  api.logger.info(
    `Prisma AIRS v2.1.0 (prompt=${config.prompt_scanning}, response=${config.response_scanning}, tools=${config.tool_protection})`
  );

  // Hook context wrapper
  const hookCtx = (ctx: any) => ({ ...ctx, cfg: api.config });

  let hookCount = 0;

  if (config.prompt_scanning) {
    hookCount += registerPromptGuardHooks(api, hookCtx);
  }
  if (config.response_scanning) {
    hookCount += registerResponseGuardHooks(api, hookCtx);
  }
  if (config.tool_protection) {
    hookCount += registerToolInputGuardHooks(api, hookCtx);
    hookCount += registerToolOutputAuditHooks(api, hookCtx);
  }

  api.logger.debug(`Prisma AIRS: registered ${hookCount} hook(s)`);

  // ── Gateway RPC ───────────────────────────────────────────────────

  api.registerGatewayMethod("prisma-airs.status", ({ respond }) => {
    const hasApiKey = isConfigured(config.api_key);
    respond(true, {
      plugin: "prisma-airs",
      version: "2.1.0",
      config: {
        profile_name: config.profile_name,
        app_name: config.app_name,
        prompt_scanning: config.prompt_scanning,
        response_scanning: config.response_scanning,
        tool_protection: config.tool_protection,
        fail_closed: config.fail_closed,
        dlp_mask_only: config.dlp_mask_only,
      },
      api_key_set: hasApiKey,
      status: hasApiKey ? "ready" : "missing_api_key",
    });
  });

  api.registerGatewayMethod("prisma-airs.scan", (ctx: any) => {
    const { respond, params } = ctx;
    (async () => {
      try {
        const request = buildScanRequest(params as ScanRequest | undefined, config);
        if (!request.prompt && !request.response) {
          respond(false, { error: "Either prompt or response is required" });
          return;
        }
        const result = await scan(request);
        respond(true, result);
      } catch (err) {
        api.logger.error(`prisma-airs.scan error: ${err}`);
        respond(false, { error: err instanceof Error ? err.message : String(err) });
      }
    })();
  });

  // ── Agent tool (always registered) ────────────────────────────────

  api.registerTool({
    name: "prisma_airs_scan",
    description:
      "Scan content for security threats via Prisma AIRS. " +
      "Detects prompt injection, DLP, malicious URLs, toxic content, malicious code, " +
      "agent threats, topic violations, DB security, and ungrounded responses. " +
      "Returns action (allow/warn/block), severity, and detected categories.",
    parameters: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "User prompt/message to scan for threats" },
        response: { type: "string", description: "AI response to scan (optional)" },
        sessionId: { type: "string", description: "Session ID for grouping related scans" },
        trId: { type: "string", description: "Transaction ID for prompt/response correlation" },
      },
      required: ["prompt"],
    },
    async execute(_id: string, params: Record<string, unknown>): Promise<ToolResult> {
      const request = buildScanRequest(params as ScanRequest, config);
      const result = await scan(request);
      return textResult(result);
    },
  });

  // ── CLI ────────────────────────────────────────────────────────────

  api.registerCli(
    ({ program }) => {
      const prog = program as any;

      prog
        .command("prisma-airs")
        .description("Show Prisma AIRS plugin status")
        .action(() => {
          const hasKey = isConfigured(config.api_key);
          console.log("Prisma AIRS Plugin Status");
          console.log("-------------------------");
          console.log(`Version: 2.1.0`);
          console.log(`Profile: ${config.profile_name ?? "(not set)"}`);
          console.log(`App Name: ${config.app_name}`);
          console.log(`Hook Groups:`);
          console.log(`  Prompt Scanning: ${config.prompt_scanning}`);
          console.log(`  Response Scanning: ${config.response_scanning}`);
          console.log(`  Tool Protection: ${config.tool_protection}`);
          console.log(`Fail Closed: ${config.fail_closed}`);
          console.log(`DLP Mask Only: ${config.dlp_mask_only}`);
          console.log(`API Key: ${hasKey ? "configured" : "MISSING"}`);
        });

      prog
        .command("prisma-airs-scan <text>")
        .description("Scan text for security threats")
        .option("--json", "Output as JSON")
        .option("--profile <name>", "AIRS profile name")
        .action(async (text: string, opts: Record<string, string>) => {
          const request = buildScanRequest({ prompt: text, profileName: opts.profile }, config);
          const result = await scan(request);

          if (opts.json) {
            console.log(JSON.stringify(result, null, 2));
          } else {
            const emoji: Record<string, string> = {
              SAFE: "OK",
              LOW: "--",
              MEDIUM: "!",
              HIGH: "!!",
              CRITICAL: "!!!",
            };
            console.log(`[${emoji[result.severity] ?? "?"}] ${result.severity}`);
            console.log(`Action: ${result.action}`);
            if (result.categories.length > 0)
              console.log(`Categories: ${result.categories.join(", ")}`);
            if (result.scanId) console.log(`Scan ID: ${result.scanId}`);
            if (result.reportId) console.log(`Report ID: ${result.reportId}`);
            console.log(`Profile: ${result.profileName}`);
            console.log(`Latency: ${result.latencyMs}ms`);
            if (result.error) console.log(`Error: ${result.error}`);
          }
        });
    },
    { commands: ["prisma-airs", "prisma-airs-scan"] }
  );
}

// Plugin metadata
export const id = "prisma-airs";
export const name = "Prisma AIRS Security";
export const version = "2.1.0";

// Re-exports
export { scan, isConfigured } from "./src/scanner";
export type { ScanRequest, ScanResult } from "./src/scanner";
export { resolveConfig } from "./src/config";
export type { PrismaAirsConfig } from "./src/config";
