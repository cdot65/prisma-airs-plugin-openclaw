/**
 * Tests for v2.1 plugin registration.
 *
 * Hook registration is stubbed out (handlers not yet created).
 * Verifies config resolution, gateway RPC, tool, and CLI registration.
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
