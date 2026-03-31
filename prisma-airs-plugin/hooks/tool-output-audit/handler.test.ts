import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/scanner.ts", () => ({
  scan: vi.fn(),
}));

import { registerToolOutputAuditHooks } from "./handler";
import { scan } from "../../src/scanner";

const mockScan = vi.mocked(scan);

function createMockApi() {
  const handlers: Record<string, (...args: any[]) => any> = {};
  return {
    api: {
      on: vi.fn((event: string, handler: (...args: any[]) => any) => {
        handlers[event] = handler;
      }),
      logger: { info: vi.fn(), debug: vi.fn() },
    },
    handlers,
  };
}

function createMockCtx(overrides: Record<string, any> = {}) {
  return { sessionKey: "test-session", ...overrides };
}

function allowResult() {
  return {
    action: "allow",
    severity: "SAFE",
    categories: ["safe"],
    scanId: "scan-1",
    reportId: "report-1",
    profileName: "default",
    promptDetected: {
      injection: false,
      dlp: false,
      urlCats: false,
      toxicContent: false,
      maliciousCode: false,
      agent: false,
      topicViolation: false,
    },
    responseDetected: {
      dlp: false,
      urlCats: false,
      dbSecurity: false,
      toxicContent: false,
      maliciousCode: false,
      agent: false,
      ungrounded: false,
      topicViolation: false,
    },
    latencyMs: 50,
    timeout: false,
    hasError: false,
    contentErrors: [],
  };
}

describe("registerToolOutputAuditHooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers one after_tool_call hook and returns 1", () => {
    const { api } = createMockApi();
    const count = registerToolOutputAuditHooks(api as any, (ctx: any) => ctx);
    expect(count).toBe(1);
    expect(api.on).toHaveBeenCalledWith("after_tool_call", expect.any(Function));
  });

  it("calls hookCtx on every invocation", async () => {
    const { api, handlers } = createMockApi();
    const hookCtx = vi.fn((ctx: any) => ({
      ...ctx,
      cfg: { plugins: { entries: { "prisma-airs": { config: { profile_name: "test" } } } } },
    }));
    registerToolOutputAuditHooks(api as any, hookCtx);
    mockScan.mockResolvedValue(allowResult() as any);
    await handlers["after_tool_call"]({ toolName: "Bash", result: "output text" }, createMockCtx());
    expect(hookCtx).toHaveBeenCalledTimes(1);
  });

  it("scans tool output and returns void (fire-and-forget)", async () => {
    const { api, handlers } = createMockApi();
    registerToolOutputAuditHooks(api as any, (ctx: any) => ctx);
    mockScan.mockResolvedValue(allowResult() as any);
    const result = await handlers["after_tool_call"](
      { toolName: "Bash", result: "file list output" },
      createMockCtx()
    );
    expect(result).toBeUndefined();
    expect(mockScan).toHaveBeenCalledWith(
      expect.objectContaining({
        response: "file list output",
        toolEvents: [
          expect.objectContaining({
            metadata: expect.objectContaining({
              ecosystem: "mcp",
              method: "tool_result",
              toolInvoked: "Bash",
            }),
          }),
        ],
      })
    );
  });

  it("serializes object results to JSON", async () => {
    const { api, handlers } = createMockApi();
    registerToolOutputAuditHooks(api as any, (ctx: any) => ctx);
    mockScan.mockResolvedValue(allowResult() as any);
    await handlers["after_tool_call"](
      { toolName: "Read", result: { content: "file data" } },
      createMockCtx()
    );
    expect(mockScan).toHaveBeenCalledWith(
      expect.objectContaining({ response: JSON.stringify({ content: "file data" }) })
    );
  });

  it("skips scan when result is empty", async () => {
    const { api, handlers } = createMockApi();
    registerToolOutputAuditHooks(api as any, (ctx: any) => ctx);
    await handlers["after_tool_call"]({ toolName: "Bash", result: "" }, createMockCtx());
    expect(mockScan).not.toHaveBeenCalled();
  });

  it("skips scan when result is undefined", async () => {
    const { api, handlers } = createMockApi();
    registerToolOutputAuditHooks(api as any, (ctx: any) => ctx);
    await handlers["after_tool_call"]({ toolName: "Bash" }, createMockCtx());
    expect(mockScan).not.toHaveBeenCalled();
  });

  it("catches and logs scan errors without throwing", async () => {
    const { api, handlers } = createMockApi();
    registerToolOutputAuditHooks(api as any, (ctx: any) => ctx);
    mockScan.mockRejectedValue(new Error("AIRS unavailable"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      handlers["after_tool_call"]({ toolName: "Bash", result: "output" }, createMockCtx())
    ).resolves.toBeUndefined();
    consoleSpy.mockRestore();
  });
});
