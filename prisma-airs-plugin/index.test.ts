/**
 * Tests for plugin hook registration via api.on()
 *
 * Verifies that register() programmatically registers all 12 hooks
 * based on resolved mode configuration, replacing HOOK.md-based discovery.
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

  const defaultPluginConfig = {
    profile_name: "default",
    app_name: "openclaw",
    api_key: "test-key",
    reminder_mode: "on",
    audit_mode: "deterministic",
    context_injection_mode: "deterministic",
    outbound_mode: "deterministic",
    tool_gating_mode: "deterministic",
    inbound_block_mode: "deterministic",
    outbound_block_mode: "deterministic",
    tool_guard_mode: "deterministic",
    prompt_scan_mode: "deterministic",
    tool_redact_mode: "deterministic",
    llm_audit_mode: "deterministic",
    tool_audit_mode: "deterministic",
    fail_closed: true,
    dlp_mask_only: true,
    high_risk_tools: ["exec", "Bash"],
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

describe("register() hook registration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers all 12 hooks when all modes are deterministic", async () => {
    const { api, onCalls } = createMockApi();
    const { default: register } = await import("./index");
    register(api as never);

    // Expected: 13 api.on() calls (llm_audit registers 2: llm_input + llm_output)
    expect(onCalls).toHaveLength(13);

    const eventNames = onCalls.map((c) => c.event);

    // before_agent_start: guard + context = 2
    expect(eventNames.filter((e) => e === "before_agent_start")).toHaveLength(2);

    // message_received: audit = 1
    expect(eventNames.filter((e) => e === "message_received")).toHaveLength(1);

    // before_prompt_build: prompt-scan = 1
    expect(eventNames.filter((e) => e === "before_prompt_build")).toHaveLength(1);

    // before_message_write: inbound-block + outbound-block = 2
    expect(eventNames.filter((e) => e === "before_message_write")).toHaveLength(2);

    // message_sending: outbound = 1
    expect(eventNames.filter((e) => e === "message_sending")).toHaveLength(1);

    // before_tool_call: tools + tool-guard = 2
    expect(eventNames.filter((e) => e === "before_tool_call")).toHaveLength(2);

    // tool_result_persist: tool-redact = 1
    expect(eventNames.filter((e) => e === "tool_result_persist")).toHaveLength(1);

    // llm_input + llm_output: llm-audit = 2
    expect(eventNames.filter((e) => e === "llm_input")).toHaveLength(1);
    expect(eventNames.filter((e) => e === "llm_output")).toHaveLength(1);

    // after_tool_call: tool-audit = 1
    expect(eventNames.filter((e) => e === "after_tool_call")).toHaveLength(1);
  });

  it("skips guard hook when reminder_mode is off", async () => {
    const { api, onCalls } = createMockApi({ reminder_mode: "off" });
    const { default: register } = await import("./index");
    register(api as never);

    const agentStartHandlers = onCalls.filter((c) => c.event === "before_agent_start");
    // Only context injection, no guard
    expect(agentStartHandlers).toHaveLength(1);
  });

  it("skips audit hook when audit_mode is off", async () => {
    const { api, onCalls } = createMockApi({ audit_mode: "off" });
    const { default: register } = await import("./index");
    register(api as never);

    const messageReceivedHandlers = onCalls.filter((c) => c.event === "message_received");
    expect(messageReceivedHandlers).toHaveLength(0);
  });

  it("skips context hook when context_injection_mode is off", async () => {
    const { api, onCalls } = createMockApi({ context_injection_mode: "off" });
    const { default: register } = await import("./index");
    register(api as never);

    const agentStartHandlers = onCalls.filter((c) => c.event === "before_agent_start");
    // Only guard, no context
    expect(agentStartHandlers).toHaveLength(1);
  });

  it("skips outbound hook when outbound_mode is off", async () => {
    const { api, onCalls } = createMockApi({ outbound_mode: "off" });
    const { default: register } = await import("./index");
    register(api as never);

    const messageSendingHandlers = onCalls.filter((c) => c.event === "message_sending");
    expect(messageSendingHandlers).toHaveLength(0);
  });

  it("skips tool gating hook when tool_gating_mode is off", async () => {
    const { api, onCalls } = createMockApi({ tool_gating_mode: "off" });
    const { default: register } = await import("./index");
    register(api as never);

    const beforeToolCallHandlers = onCalls.filter((c) => c.event === "before_tool_call");
    // Only tool-guard, no tools (cache-based gating)
    expect(beforeToolCallHandlers).toHaveLength(1);
  });

  it("skips inbound-block when inbound_block_mode is off", async () => {
    const { api, onCalls } = createMockApi({ inbound_block_mode: "off" });
    const { default: register } = await import("./index");
    register(api as never);

    const writeHandlers = onCalls.filter((c) => c.event === "before_message_write");
    // Only outbound-block
    expect(writeHandlers).toHaveLength(1);
  });

  it("skips outbound-block when outbound_block_mode is off", async () => {
    const { api, onCalls } = createMockApi({ outbound_block_mode: "off" });
    const { default: register } = await import("./index");
    register(api as never);

    const writeHandlers = onCalls.filter((c) => c.event === "before_message_write");
    // Only inbound-block
    expect(writeHandlers).toHaveLength(1);
  });

  it("skips tool-guard when tool_guard_mode is off", async () => {
    const { api, onCalls } = createMockApi({ tool_guard_mode: "off" });
    const { default: register } = await import("./index");
    register(api as never);

    const beforeToolCallHandlers = onCalls.filter((c) => c.event === "before_tool_call");
    // Only tools (cache-based gating), no tool-guard
    expect(beforeToolCallHandlers).toHaveLength(1);
  });

  it("skips prompt-scan when prompt_scan_mode is off", async () => {
    const { api, onCalls } = createMockApi({ prompt_scan_mode: "off" });
    const { default: register } = await import("./index");
    register(api as never);

    const promptBuildHandlers = onCalls.filter((c) => c.event === "before_prompt_build");
    expect(promptBuildHandlers).toHaveLength(0);
  });

  it("skips tool-redact when tool_redact_mode is off", async () => {
    const { api, onCalls } = createMockApi({ tool_redact_mode: "off" });
    const { default: register } = await import("./index");
    register(api as never);

    const persistHandlers = onCalls.filter((c) => c.event === "tool_result_persist");
    expect(persistHandlers).toHaveLength(0);
  });

  it("skips llm-audit when llm_audit_mode is off", async () => {
    const { api, onCalls } = createMockApi({ llm_audit_mode: "off" });
    const { default: register } = await import("./index");
    register(api as never);

    const llmInputHandlers = onCalls.filter((c) => c.event === "llm_input");
    const llmOutputHandlers = onCalls.filter((c) => c.event === "llm_output");
    expect(llmInputHandlers).toHaveLength(0);
    expect(llmOutputHandlers).toHaveLength(0);
  });

  it("skips tool-audit when tool_audit_mode is off", async () => {
    const { api, onCalls } = createMockApi({ tool_audit_mode: "off" });
    const { default: register } = await import("./index");
    register(api as never);

    const afterToolCallHandlers = onCalls.filter((c) => c.event === "after_tool_call");
    expect(afterToolCallHandlers).toHaveLength(0);
  });

  it("registers zero hooks when all modes are off", async () => {
    const { api, onCalls } = createMockApi({
      reminder_mode: "off",
      audit_mode: "off",
      context_injection_mode: "off",
      outbound_mode: "off",
      tool_gating_mode: "off",
      inbound_block_mode: "off",
      outbound_block_mode: "off",
      tool_guard_mode: "off",
      prompt_scan_mode: "off",
      tool_redact_mode: "off",
      llm_audit_mode: "off",
      tool_audit_mode: "off",
    });
    const { default: register } = await import("./index");
    register(api as never);

    expect(onCalls).toHaveLength(0);
  });
});
