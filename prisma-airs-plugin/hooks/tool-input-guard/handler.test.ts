import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/scanner.ts", () => ({
  scan: vi.fn(),
}));

import { registerToolInputGuardHooks } from "./handler";
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

function blockResult() {
  return { ...allowResult(), action: "block", severity: "CRITICAL", categories: ["agent_threat"] };
}

describe("registerToolInputGuardHooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers one before_tool_call hook and returns 1", () => {
    const { api } = createMockApi();
    const count = registerToolInputGuardHooks(api as any, (ctx: any) => ctx);
    expect(count).toBe(1);
    expect(api.on).toHaveBeenCalledWith("before_tool_call", expect.any(Function));
  });

  it("calls hookCtx on every invocation", async () => {
    const { api, handlers } = createMockApi();
    const hookCtx = vi.fn((ctx: any) => ({
      ...ctx,
      cfg: { plugins: { entries: { "prisma-airs": { config: { profile_name: "test" } } } } },
    }));
    registerToolInputGuardHooks(api as any, hookCtx);
    mockScan.mockResolvedValue(allowResult() as any);
    await handlers["before_tool_call"](
      { toolName: "Bash", params: { command: "ls" } },
      createMockCtx()
    );
    expect(hookCtx).toHaveBeenCalledTimes(1);
  });

  it("returns void when AIRS allows", async () => {
    const { api, handlers } = createMockApi();
    registerToolInputGuardHooks(api as any, (ctx: any) => ctx);
    mockScan.mockResolvedValue(allowResult() as any);
    const result = await handlers["before_tool_call"](
      { toolName: "Bash", params: { command: "ls" } },
      createMockCtx()
    );
    expect(result).toBeUndefined();
  });

  it("blocks when AIRS does not allow", async () => {
    const { api, handlers } = createMockApi();
    registerToolInputGuardHooks(api as any, (ctx: any) => ctx);
    mockScan.mockResolvedValue(blockResult() as any);
    const result = await handlers["before_tool_call"](
      { toolName: "Bash", params: { command: "rm -rf /" } },
      createMockCtx()
    );
    expect(result).toEqual(
      expect.objectContaining({ block: true, blockReason: expect.stringContaining("Bash") })
    );
  });

  it("sends toolEvent with correct metadata", async () => {
    const { api, handlers } = createMockApi();
    registerToolInputGuardHooks(api as any, (ctx: any) => ctx);
    mockScan.mockResolvedValue(allowResult() as any);
    await handlers["before_tool_call"](
      { toolName: "WebFetch", serverName: "mcp-server", params: { url: "http://example.com" } },
      createMockCtx()
    );
    expect(mockScan).toHaveBeenCalledWith(
      expect.objectContaining({
        toolEvents: [
          expect.objectContaining({
            metadata: expect.objectContaining({
              ecosystem: "mcp",
              method: "tool_call",
              serverName: "mcp-server",
              toolInvoked: "WebFetch",
            }),
            input: JSON.stringify({ url: "http://example.com" }),
          }),
        ],
      })
    );
  });

  it("blocks on scan error when fail_closed", async () => {
    const { api, handlers } = createMockApi();
    const hookCtx = (ctx: any) => ({
      ...ctx,
      cfg: { plugins: { entries: { "prisma-airs": { config: { fail_closed: true } } } } },
    });
    registerToolInputGuardHooks(api as any, hookCtx);
    mockScan.mockRejectedValue(new Error("AIRS unavailable"));
    const result = await handlers["before_tool_call"](
      { toolName: "Bash", params: { command: "ls" } },
      createMockCtx()
    );
    expect(result).toEqual(
      expect.objectContaining({ block: true, blockReason: expect.stringContaining("Bash") })
    );
  });

  it("returns void on scan error when fail_open", async () => {
    const { api, handlers } = createMockApi();
    const hookCtx = (ctx: any) => ({
      ...ctx,
      cfg: { plugins: { entries: { "prisma-airs": { config: { fail_closed: false } } } } },
    });
    registerToolInputGuardHooks(api as any, hookCtx);
    mockScan.mockRejectedValue(new Error("AIRS unavailable"));
    const result = await handlers["before_tool_call"](
      { toolName: "Bash", params: { command: "ls" } },
      createMockCtx()
    );
    expect(result).toBeUndefined();
  });

  it("returns void when toolName is missing", async () => {
    const { api, handlers } = createMockApi();
    registerToolInputGuardHooks(api as any, (ctx: any) => ctx);
    const result = await handlers["before_tool_call"]({}, createMockCtx());
    expect(result).toBeUndefined();
    expect(mockScan).not.toHaveBeenCalled();
  });
});
