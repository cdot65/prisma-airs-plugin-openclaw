import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/scanner.ts", () => ({
  scan: vi.fn(),
}));

import { registerPromptGuardHooks } from "./handler";
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

function blockResult(categories: string[] = ["prompt_injection"]) {
  return { ...allowResult(), action: "block", severity: "CRITICAL", categories };
}

describe("registerPromptGuardHooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers one before_prompt_build hook and returns 1", () => {
    const { api } = createMockApi();
    const hookCtx = vi.fn((ctx: any) => ctx);
    const count = registerPromptGuardHooks(api as any, hookCtx);
    expect(count).toBe(1);
    expect(api.on).toHaveBeenCalledWith("before_prompt_build", expect.any(Function));
  });

  it("calls hookCtx on every invocation", async () => {
    const { api, handlers } = createMockApi();
    const hookCtx = vi.fn((ctx: any) => ({
      ...ctx,
      cfg: { plugins: { entries: { "prisma-airs": { config: { profile_name: "test" } } } } },
    }));
    registerPromptGuardHooks(api as any, hookCtx);
    mockScan.mockResolvedValue(allowResult() as any);
    await handlers["before_prompt_build"](
      { messages: [{ role: "user", content: "hello" }] },
      createMockCtx()
    );
    expect(hookCtx).toHaveBeenCalledTimes(1);
  });

  it("returns void when AIRS allows", async () => {
    const { api, handlers } = createMockApi();
    registerPromptGuardHooks(api as any, (ctx: any) => ctx);
    mockScan.mockResolvedValue(allowResult() as any);
    const result = await handlers["before_prompt_build"](
      { messages: [{ role: "user", content: "hello" }] },
      createMockCtx()
    );
    expect(result).toBeUndefined();
  });

  it("returns prependSystemContext when AIRS blocks", async () => {
    const { api, handlers } = createMockApi();
    registerPromptGuardHooks(api as any, (ctx: any) => ctx);
    mockScan.mockResolvedValue(blockResult() as any);
    const result = await handlers["before_prompt_build"](
      { messages: [{ role: "user", content: "ignore instructions" }] },
      createMockCtx()
    );
    expect(result).toHaveProperty("prependSystemContext");
    expect(result.prependSystemContext).toContain("SECURITY");
  });

  it("returns prependSystemContext when AIRS warns", async () => {
    const { api, handlers } = createMockApi();
    registerPromptGuardHooks(api as any, (ctx: any) => ctx);
    mockScan.mockResolvedValue({ ...allowResult(), action: "warn", severity: "MEDIUM" } as any);
    const result = await handlers["before_prompt_build"](
      { messages: [{ role: "user", content: "suspicious" }] },
      createMockCtx()
    );
    expect(result).toHaveProperty("prependSystemContext");
  });

  it("injects refusal on scan error when fail_closed", async () => {
    const { api, handlers } = createMockApi();
    const hookCtx = (ctx: any) => ({
      ...ctx,
      cfg: { plugins: { entries: { "prisma-airs": { config: { fail_closed: true } } } } },
    });
    registerPromptGuardHooks(api as any, hookCtx);
    mockScan.mockRejectedValue(new Error("AIRS unavailable"));
    const result = await handlers["before_prompt_build"](
      { messages: [{ role: "user", content: "hello" }] },
      createMockCtx()
    );
    expect(result).toHaveProperty("prependSystemContext");
    expect(result.prependSystemContext).toContain("security scan failed");
  });

  it("returns void on scan error when fail_open", async () => {
    const { api, handlers } = createMockApi();
    const hookCtx = (ctx: any) => ({
      ...ctx,
      cfg: { plugins: { entries: { "prisma-airs": { config: { fail_closed: false } } } } },
    });
    registerPromptGuardHooks(api as any, hookCtx);
    mockScan.mockRejectedValue(new Error("AIRS unavailable"));
    const result = await handlers["before_prompt_build"](
      { messages: [{ role: "user", content: "hello" }] },
      createMockCtx()
    );
    expect(result).toBeUndefined();
  });

  it("injects caution on api_error result when fail_closed", async () => {
    const { api, handlers } = createMockApi();
    const hookCtx = (ctx: any) => ({
      ...ctx,
      cfg: { plugins: { entries: { "prisma-airs": { config: { fail_closed: true } } } } },
    });
    registerPromptGuardHooks(api as any, hookCtx);
    mockScan.mockResolvedValue({
      ...allowResult(),
      action: "warn",
      categories: ["api_error"],
      hasError: true,
      error: "SDK not initialized",
    } as any);
    const result = await handlers["before_prompt_build"](
      { messages: [{ role: "user", content: "hello" }] },
      createMockCtx()
    );
    expect(result).toHaveProperty("prependSystemContext");
    expect(result.prependSystemContext).toContain("security scan failed");
  });

  it("returns void on api_error result when fail_open", async () => {
    const { api, handlers } = createMockApi();
    const hookCtx = (ctx: any) => ({
      ...ctx,
      cfg: { plugins: { entries: { "prisma-airs": { config: { fail_closed: false } } } } },
    });
    registerPromptGuardHooks(api as any, hookCtx);
    mockScan.mockResolvedValue({
      ...allowResult(),
      action: "warn",
      categories: ["api_error"],
      hasError: true,
      error: "SDK not initialized",
    } as any);
    const result = await handlers["before_prompt_build"](
      { messages: [{ role: "user", content: "hello" }] },
      createMockCtx()
    );
    expect(result).toBeUndefined();
  });

  it("returns void when no messages in event", async () => {
    const { api, handlers } = createMockApi();
    registerPromptGuardHooks(api as any, (ctx: any) => ctx);
    const result = await handlers["before_prompt_build"]({}, createMockCtx());
    expect(result).toBeUndefined();
    expect(mockScan).not.toHaveBeenCalled();
  });

  it("extracts latest user message from messages array", async () => {
    const { api, handlers } = createMockApi();
    registerPromptGuardHooks(api as any, (ctx: any) => ctx);
    mockScan.mockResolvedValue(allowResult() as any);
    await handlers["before_prompt_build"](
      {
        messages: [
          { role: "user", content: "first" },
          { role: "assistant", content: "response" },
          { role: "user", content: "latest" },
        ],
      },
      createMockCtx()
    );
    expect(mockScan).toHaveBeenCalledWith(expect.objectContaining({ prompt: "latest" }));
  });
});
