/**
 * Prisma AIRS Plugin for OpenClaw
 *
 * AI Runtime Security scanning via Palo Alto Networks.
 * Bundles:
 * - prisma-airs skill (CLI scanning tools)
 * - prisma-airs-guard hook (bootstrap reminder injection)
 */

// Plugin config interface
interface PrismaAirsConfig {
  profile_name?: string;
  app_name?: string;
  reminder_enabled?: boolean;
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
    handler: (ctx: { respond: (ok: boolean, data: unknown) => void }) => void
  ) => void;
  registerCli: (
    setup: (ctx: { program: unknown }) => void,
    opts: { commands: string[] }
  ) => void;
}

// Get plugin config from OpenClaw config
function getPluginConfig(api: PluginApi): PrismaAirsConfig {
  return api.config?.plugins?.entries?.["prisma-airs"]?.config ?? {};
}

// Register the plugin
export default function register(api: PluginApi): void {
  const config = getPluginConfig(api);
  api.logger.info(
    `Prisma AIRS plugin loaded (reminder_enabled=${config.reminder_enabled ?? true})`
  );

  // Hooks are loaded via the "hooks" array in openclaw.plugin.json

  // Register RPC method for status check
  api.registerGatewayMethod("prisma-airs.status", ({ respond }) => {
    const cfg = getPluginConfig(api);
    const hasApiKey = !!process.env.PANW_AI_SEC_API_KEY;
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

  // Register CLI command for quick status
  api.registerCli(
    ({ program }) => {
      const prog = program as {
        command: (name: string) => {
          description: (desc: string) => {
            action: (fn: () => void) => void;
          };
        };
      };
      prog
        .command("prisma-airs")
        .description("Show Prisma AIRS plugin status")
        .action(() => {
          const cfg = getPluginConfig(api);
          const hasKey = !!process.env.PANW_AI_SEC_API_KEY;
          console.log("Prisma AIRS Plugin Status");
          console.log("-------------------------");
          console.log(`Profile: ${cfg.profile_name ?? "default"}`);
          console.log(`App Name: ${cfg.app_name ?? "openclaw"}`);
          console.log(`Reminder: ${cfg.reminder_enabled ?? true}`);
          console.log(`API Key: ${hasKey ? "configured" : "MISSING"}`);
          if (!hasKey) {
            console.log("\nSet PANW_AI_SEC_API_KEY environment variable");
          }
        });
    },
    { commands: ["prisma-airs"] }
  );
}

// Export plugin metadata for discovery
export const id = "prisma-airs";
export const name = "Prisma AIRS Security";
export const version = "0.1.0";
