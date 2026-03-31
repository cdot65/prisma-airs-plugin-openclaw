/**
 * Tests for v2.1.0 plugin registration.
 *
 * Verifies config resolution, gateway RPC, tool, CLI, and hook registration.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@cdot65/prisma-airs-sdk", () => ({
  init: vi.fn(),
  scan: vi.fn(),
}));

vi.mock("./src/scanner.ts", () => ({
  scan: vi.fn(),
  isConfigured: vi.fn().mockReturnValue(true),
}));

vi.mock("./hooks/prompt-guard/handler.ts", () => ({
  registerPromptGuardHooks: vi.fn().mockReturnValue(1),
}));

vi.mock("./hooks/response-guard/handler.ts", () => ({
  registerResponseGuardHooks: vi.fn().mockReturnValue(1),
}));

vi.mock("./hooks/tool-input-guard/handler.ts", () => ({
  registerToolInputGuardHooks: vi.fn().mockReturnValue(1),
}));

vi.mock("./hooks/tool-output-audit/handler.ts", () => ({
  registerToolOutputAuditHooks: vi.fn().mockReturnValue(1),
}));

import { registerPromptGuardHooks } from "./hooks/prompt-guard/handler";
import { registerResponseGuardHooks } from "./hooks/response-guard/handler";
import { registerToolInputGuardHooks } from "./hooks/tool-input-guard/handler";
import { registerToolOutputAuditHooks } from "./hooks/tool-output-audit/handler";

function createMockApi(configOverrides: Record<string, unknown> = {}) {
  const tools: string[] = [];

  const defaultPluginConfig = {
    profile_name: "default",
    app_name: "openclaw",
    api_key: "test-key",
    fail_closed: true,
    dlp_mask_only: true,
    prompt_scanning: true,
    response_scanning: true,
    tool_protection: true,
    ...configOverrides,
  };

  return {
    api: {
      logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
      config: {
        plugins: {
          entries: { "prisma-airs": { config: defaultPluginConfig } },
        },
      },
      on: vi.fn(),
      registerGatewayMethod: vi.fn(),
      registerTool: vi.fn(({ name }: { name: string }) => {
        tools.push(name);
      }),
      registerCli: vi.fn(),
    },
    tools,
  };
}

describe("register() basics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("always registers prisma_airs_scan tool", async () => {
    const { api, tools } = createMockApi();
    const { default: register } = await import("./index");
    register(api as never);
    expect(tools).toContain("prisma_airs_scan");
  });

  it("registers gateway methods", async () => {
    const { api } = createMockApi();
    const { default: register } = await import("./index");
    register(api as never);
    expect(api.registerGatewayMethod).toHaveBeenCalledWith(
      "prisma-airs.status",
      expect.any(Function)
    );
    expect(api.registerGatewayMethod).toHaveBeenCalledWith(
      "prisma-airs.scan",
      expect.any(Function)
    );
  });

  it("registers CLI commands", async () => {
    const { api } = createMockApi();
    const { default: register } = await import("./index");
    register(api as never);
    expect(api.registerCli).toHaveBeenCalledWith(expect.any(Function), {
      commands: ["prisma-airs", "prisma-airs-scan"],
    });
  });

  it("warns when no API key configured", async () => {
    const { api } = createMockApi({ api_key: undefined });
    const { default: register } = await import("./index");
    register(api as never);
    expect(api.logger.warn).toHaveBeenCalledWith(expect.stringContaining("no API key"));
  });
});

describe("register() hook registration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers all 4 hooks when all features enabled", async () => {
    const { api } = createMockApi();
    const { default: register } = await import("./index");
    register(api as never);
    expect(registerPromptGuardHooks).toHaveBeenCalledTimes(1);
    expect(registerResponseGuardHooks).toHaveBeenCalledTimes(1);
    expect(registerToolInputGuardHooks).toHaveBeenCalledTimes(1);
    expect(registerToolOutputAuditHooks).toHaveBeenCalledTimes(1);
  });

  it("skips prompt-guard when prompt_scanning disabled", async () => {
    const { api } = createMockApi({ prompt_scanning: false });
    const { default: register } = await import("./index");
    register(api as never);
    expect(registerPromptGuardHooks).not.toHaveBeenCalled();
    expect(registerResponseGuardHooks).toHaveBeenCalledTimes(1);
  });

  it("skips response-guard when response_scanning disabled", async () => {
    const { api } = createMockApi({ response_scanning: false });
    const { default: register } = await import("./index");
    register(api as never);
    expect(registerResponseGuardHooks).not.toHaveBeenCalled();
    expect(registerPromptGuardHooks).toHaveBeenCalledTimes(1);
  });

  it("skips tool hooks when tool_protection disabled", async () => {
    const { api } = createMockApi({ tool_protection: false });
    const { default: register } = await import("./index");
    register(api as never);
    expect(registerToolInputGuardHooks).not.toHaveBeenCalled();
    expect(registerToolOutputAuditHooks).not.toHaveBeenCalled();
    expect(registerPromptGuardHooks).toHaveBeenCalledTimes(1);
  });

  it("passes hookCtx function to each handler", async () => {
    const { api } = createMockApi();
    const { default: register } = await import("./index");
    register(api as never);
    expect(registerPromptGuardHooks).toHaveBeenCalledWith(api, expect.any(Function));
    expect(registerResponseGuardHooks).toHaveBeenCalledWith(api, expect.any(Function));
    expect(registerToolInputGuardHooks).toHaveBeenCalledWith(api, expect.any(Function));
    expect(registerToolOutputAuditHooks).toHaveBeenCalledWith(api, expect.any(Function));
  });
});
