/**
 * Prisma AIRS Plugin for OpenClaw
 *
 * AI Runtime Security scanning via Palo Alto Networks.
 * Pure TypeScript implementation with direct AIRS API integration.
 *
 * Provides:
 * - Gateway RPC method: prisma-airs.scan
 * - Agent tool: prisma_airs_scan
 * - Bootstrap hook: prisma-airs-guard (reminds agent about scanning)
 */

import { scan, isConfigured, ScanRequest, ScanResult } from "./src/scanner";

// Plugin config interface
interface PrismaAirsConfig {
  profile_name?: string;
  app_name?: string;
  reminder_enabled?: boolean;
}

// Tool parameter schema
interface ToolParameterProperty {
  type: string;
  description: string;
}

interface ToolParameters {
  type: "object";
  properties: Record<string, ToolParameterProperty>;
  required?: string[];
}

// Plugin API type (subset of full API)
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
          config?: PrismaAirsConfig;
        };
      };
    };
  };
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
    handler: (params: ScanRequest) => Promise<ScanResult>;
  }) => void;
  registerCli: (setup: (ctx: { program: unknown }) => void, opts: { commands: string[] }) => void;
}

// Get plugin config from OpenClaw config
function getPluginConfig(api: PluginApi): PrismaAirsConfig {
  return api.config?.plugins?.entries?.["prisma-airs"]?.config ?? {};
}

// Merge plugin config defaults into scan request
function buildScanRequest(params: ScanRequest | undefined, config: PrismaAirsConfig): ScanRequest {
  return {
    prompt: params?.prompt,
    response: params?.response,
    sessionId: params?.sessionId,
    trId: params?.trId,
    profileName: params?.profileName ?? config.profile_name ?? "default",
    appName: params?.appName ?? config.app_name ?? "openclaw",
    appUser: params?.appUser,
    aiModel: params?.aiModel,
  };
}

// Register the plugin
export default function register(api: PluginApi): void {
  const config = getPluginConfig(api);
  api.logger.info(
    `Prisma AIRS plugin loaded (reminder_enabled=${config.reminder_enabled ?? true})`
  );

  // Register RPC method for status check
  api.registerGatewayMethod("prisma-airs.status", ({ respond }) => {
    const cfg = getPluginConfig(api);
    const hasApiKey = isConfigured();
    respond(true, {
      plugin: "prisma-airs",
      version: "0.1.0",
      config: {
        profile_name: cfg.profile_name ?? "default",
        app_name: cfg.app_name ?? "openclaw",
        reminder_enabled: cfg.reminder_enabled ?? true,
      },
      api_key_set: hasApiKey,
      status: hasApiKey ? "ready" : "missing_api_key",
    });
  });

  // Register RPC method for scanning
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  api.registerGatewayMethod("prisma-airs.scan", (ctx: any) => {
    const { respond, params } = ctx;

    // Wrap in async IIFE to handle promise
    (async () => {
      try {
        const cfg = getPluginConfig(api);
        const request = buildScanRequest(params as ScanRequest | undefined, cfg);

        if (!request.prompt && !request.response) {
          respond(false, { error: "Either prompt or response is required" });
          return;
        }

        const result = await scan(request);
        respond(true, result);
      } catch (err) {
        api.logger.error(`prisma-airs.scan error: ${err}`);
        respond(false, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();
  });

  // Register agent tool for scanning
  api.registerTool({
    name: "prisma_airs_scan",
    description:
      "Scan content for security threats via Prisma AIRS. " +
      "Detects prompt injection, data leakage, malicious URLs, and other threats. " +
      "Returns action (allow/warn/block), severity, and detected categories.",
    parameters: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "User prompt/message to scan for threats",
        },
        response: {
          type: "string",
          description: "AI response to scan (optional)",
        },
        sessionId: {
          type: "string",
          description: "Session ID for grouping related scans",
        },
        trId: {
          type: "string",
          description: "Transaction ID for prompt/response correlation",
        },
      },
      required: ["prompt"],
    },
    handler: async (params: ScanRequest): Promise<ScanResult> => {
      const cfg = getPluginConfig(api);
      const request = buildScanRequest(params, cfg);
      return scan(request);
    },
  });

  // Register CLI command for status/scanning
  api.registerCli(
    ({ program }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prog = program as any;

      // Status command
      prog
        .command("prisma-airs")
        .description("Show Prisma AIRS plugin status")
        .action(() => {
          const cfg = getPluginConfig(api);
          const hasKey = isConfigured();
          console.log("Prisma AIRS Plugin Status");
          console.log("-------------------------");
          console.log(`Version: 0.1.0`);
          console.log(`Profile: ${cfg.profile_name ?? "default"}`);
          console.log(`App Name: ${cfg.app_name ?? "openclaw"}`);
          console.log(`Reminder: ${cfg.reminder_enabled ?? true}`);
          console.log(`API Key: ${hasKey ? "configured" : "MISSING"}`);
          if (!hasKey) {
            console.log("\nSet PANW_AI_SEC_API_KEY environment variable");
          }
        });

      // Scan command
      prog
        .command("prisma-airs-scan <text>")
        .description("Scan text for security threats")
        .option("--json", "Output as JSON")
        .option("--profile <name>", "AIRS profile name")
        .action(async (text: string, opts: Record<string, string>) => {
          const cfg = getPluginConfig(api);
          const request = buildScanRequest({ prompt: text, profileName: opts.profile }, cfg);
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
            if (result.categories.length > 0) {
              console.log(`Categories: ${result.categories.join(", ")}`);
            }
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

// Export plugin metadata for discovery
export const id = "prisma-airs";
export const name = "Prisma AIRS Security";
export const version = "0.1.0";

// Re-export scanner types and functions
export { scan, isConfigured } from "./src/scanner";
export type { ScanRequest, ScanResult } from "./src/scanner";
