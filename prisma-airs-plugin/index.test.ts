/**
 * Tests for v2 plugin hook group registration via api.on()
 *
 * Verifies that register() registers hook groups based on boolean config,
 * replacing the old 12-hook mode-based registration and probabilistic tools.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@cdot65/prisma-airs-sdk", () => ({
  init: vi.fn(),
  scan: vi.fn(),
}));

vi.mock("./src/scanner.ts", () => ({
  scan: vi.fn(),
  isConfigured: vi.fn().mockReturnValue(true),
  defaultPromptDetected: vi.fn().mockReturnValue({
    promptInjection: false,
    urlFiltering: false,
    dlp: false,
    toxicContent: false,
    maliciousCode: false,
    agentThreat: false,
    topicViolation: false,
    dbSecurity: false,
  }),
  defaultResponseDetected: vi.fn().mockReturnValue({
    urlFiltering: false,
    dlp: false,
    toxicContent: false,
    maliciousCode: false,
    agentThreat: false,
    topicViolation: false,
    dbSecurity: false,
    ungrounded: false,
  }),
}));

vi.mock("./src/scan-cache.ts", () => ({
  getCachedScanResult: vi.fn(),
  getCachedScanResultIfMatch: vi.fn(),
  cacheScanResult: vi.fn(),
  hashMessage: vi.fn().mockReturnValue("mock-hash"),
  clearScanResult: vi.fn(),
}));

interface OnCall {
  event: string;
  handler: (...args: unknown[]) => unknown;
  opts?: { priority?: number };
}

function createMockApi(configOverrides: Record<string, unknown> = {}) {
  const onCalls: OnCall[] = [];
  const tools: string[] = [];

  // v2 boolean config — all groups enabled by default except llm_audit
  const defaultPluginConfig = {
    profile_name: "default",
    app_name: "openclaw",
    api_key: "test-key",
    fail_closed: true,
    dlp_mask_only: true,
    inbound_scanning: true,
    outbound_scanning: true,
    tool_protection: true,
    security_context: true,
    llm_audit: false,
    ...configOverrides,
  };

  return {
    api: {
      logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      config: {
        plugins: {
          entries: {
            "prisma-airs": {
              config: defaultPluginConfig,
            },
          },
        },
      },
      on: vi.fn(
        (event: string, handler: (...args: unknown[]) => unknown, opts?: { priority?: number }) => {
          onCalls.push({ event, handler, opts });
        }
      ),
      registerGatewayMethod: vi.fn(),
      registerTool: vi.fn(({ name }: { name: string }) => {
        tools.push(name);
      }),
      registerCli: vi.fn(),
    },
    onCalls,
    tools,
  };
}

describe("register() hook group registration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers all hooks when all groups enabled (including llm_audit)", async () => {
    const { api, onCalls } = createMockApi({ llm_audit: true });
    const { default: register } = await import("./index");
    register(api as never);

    // inbound=2, outbound=2, tool_protection=4, security_context=2, llm_audit=3 → 13
    expect(onCalls).toHaveLength(13);

    const eventNames = onCalls.map((c) => c.event);

    // before_agent_start: security_context group (guard + context) = 2
    expect(eventNames.filter((e) => e === "before_agent_start")).toHaveLength(2);

    // message_received: inbound group (audit) = 1
    expect(eventNames.filter((e) => e === "message_received")).toHaveLength(1);

    // before_message_write: inbound(1) + outbound(1) = 2
    expect(eventNames.filter((e) => e === "before_message_write")).toHaveLength(2);

    // message_sending: outbound group = 1
    expect(eventNames.filter((e) => e === "message_sending")).toHaveLength(1);

    // before_tool_call: tool_protection group (cache gating + active guard) = 2
    expect(eventNames.filter((e) => e === "before_tool_call")).toHaveLength(2);

    // tool_result_persist: tool_protection group (redact) = 1
    expect(eventNames.filter((e) => e === "tool_result_persist")).toHaveLength(1);

    // after_tool_call: tool_protection group (audit) = 1
    expect(eventNames.filter((e) => e === "after_tool_call")).toHaveLength(1);

    // llm_input + llm_output: llm_audit group = 1 each
    expect(eventNames.filter((e) => e === "llm_input")).toHaveLength(1);
    expect(eventNames.filter((e) => e === "llm_output")).toHaveLength(1);

    // before_prompt_build: llm_audit group = 1
    expect(eventNames.filter((e) => e === "before_prompt_build")).toHaveLength(1);
  });

  it("registers default hooks (llm_audit off by default)", async () => {
    const { api, onCalls } = createMockApi();
    const { default: register } = await import("./index");
    register(api as never);

    // inbound=2, outbound=2, tool_protection=4, security_context=2, llm_audit=0 → 10
    expect(onCalls).toHaveLength(10);

    const eventNames = onCalls.map((c) => c.event);
    expect(eventNames.filter((e) => e === "llm_input")).toHaveLength(0);
    expect(eventNames.filter((e) => e === "llm_output")).toHaveLength(0);
    expect(eventNames.filter((e) => e === "before_prompt_build")).toHaveLength(0);
  });

  it("disables inbound_scanning group", async () => {
    const { api, onCalls } = createMockApi({ inbound_scanning: false });
    const { default: register } = await import("./index");
    register(api as never);

    const eventNames = onCalls.map((c) => c.event);

    // No message_received (audit removed)
    expect(eventNames.filter((e) => e === "message_received")).toHaveLength(0);

    // before_message_write: only outbound's assistant block (1), not inbound's user block
    expect(eventNames.filter((e) => e === "before_message_write")).toHaveLength(1);

    // Total: outbound=2, tool_protection=4, security_context=2 → 8
    expect(onCalls).toHaveLength(8);
  });

  it("disables outbound_scanning group", async () => {
    const { api, onCalls } = createMockApi({ outbound_scanning: false });
    const { default: register } = await import("./index");
    register(api as never);

    const eventNames = onCalls.map((c) => c.event);

    // No message_sending
    expect(eventNames.filter((e) => e === "message_sending")).toHaveLength(0);

    // before_message_write: only inbound's user block (1)
    expect(eventNames.filter((e) => e === "before_message_write")).toHaveLength(1);

    // Total: inbound=2, tool_protection=4, security_context=2 → 8
    expect(onCalls).toHaveLength(8);
  });

  it("disables tool_protection group", async () => {
    const { api, onCalls } = createMockApi({ tool_protection: false });
    const { default: register } = await import("./index");
    register(api as never);

    const eventNames = onCalls.map((c) => c.event);

    // No before_tool_call, tool_result_persist, or after_tool_call
    expect(eventNames.filter((e) => e === "before_tool_call")).toHaveLength(0);
    expect(eventNames.filter((e) => e === "tool_result_persist")).toHaveLength(0);
    expect(eventNames.filter((e) => e === "after_tool_call")).toHaveLength(0);

    // Total: inbound=2, outbound=2, security_context=2 → 6
    expect(onCalls).toHaveLength(6);
  });

  it("disables security_context group", async () => {
    const { api, onCalls } = createMockApi({ security_context: false });
    const { default: register } = await import("./index");
    register(api as never);

    const eventNames = onCalls.map((c) => c.event);

    // No before_agent_start
    expect(eventNames.filter((e) => e === "before_agent_start")).toHaveLength(0);

    // Total: inbound=2, outbound=2, tool_protection=4 → 8
    expect(onCalls).toHaveLength(8);
  });

  it("disables llm_audit group (already off by default)", async () => {
    const { api, onCalls } = createMockApi({ llm_audit: false });
    const { default: register } = await import("./index");
    register(api as never);

    const eventNames = onCalls.map((c) => c.event);

    expect(eventNames.filter((e) => e === "llm_input")).toHaveLength(0);
    expect(eventNames.filter((e) => e === "llm_output")).toHaveLength(0);
    expect(eventNames.filter((e) => e === "before_prompt_build")).toHaveLength(0);

    // Total: inbound=2, outbound=2, tool_protection=4, security_context=2 → 10
    expect(onCalls).toHaveLength(10);
  });

  it("registers zero hooks when all groups disabled", async () => {
    const { api, onCalls } = createMockApi({
      inbound_scanning: false,
      outbound_scanning: false,
      tool_protection: false,
      security_context: false,
      llm_audit: false,
    });
    const { default: register } = await import("./index");
    register(api as never);

    expect(onCalls).toHaveLength(0);
  });

  it("always registers prisma_airs_scan tool regardless of config", async () => {
    const { api, tools } = createMockApi({
      inbound_scanning: false,
      outbound_scanning: false,
      tool_protection: false,
      security_context: false,
      llm_audit: false,
    });
    const { default: register } = await import("./index");
    register(api as never);

    expect(tools).toContain("prisma_airs_scan");
    // No probabilistic tools
    expect(tools).not.toContain("prisma_airs_scan_prompt");
    expect(tools).not.toContain("prisma_airs_scan_response");
    expect(tools).not.toContain("prisma_airs_check_tool_safety");
  });

  it("does not register probabilistic tools in any configuration", async () => {
    const { api, tools } = createMockApi({ llm_audit: true });
    const { default: register } = await import("./index");
    register(api as never);

    // Only the base scan tool, no probabilistic tools
    expect(tools).toEqual(["prisma_airs_scan"]);
  });
});
