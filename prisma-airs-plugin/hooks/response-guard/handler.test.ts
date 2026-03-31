import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/scanner.ts", () => ({
  scan: vi.fn(),
}));

vi.mock("../../src/dlp.ts", () => ({
  maskSensitiveData: vi.fn((content: string) => content),
}));

import { registerResponseGuardHooks } from "./handler";
import { scan } from "../../src/scanner";
import { maskSensitiveData } from "../../src/dlp";

const mockScan = vi.mocked(scan);
const mockMask = vi.mocked(maskSensitiveData);

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

function blockResult(categories: string[] = ["malicious_code_response"]) {
  return { ...allowResult(), action: "block", severity: "CRITICAL", categories };
}

function dlpResult() {
  return { ...allowResult(), action: "warn", severity: "MEDIUM", categories: ["dlp_response"] };
}

describe("registerResponseGuardHooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMask.mockImplementation((content: string) => content);
  });

  it("registers one message_sending hook and returns 1", () => {
    const { api } = createMockApi();
    const count = registerResponseGuardHooks(api as any, (ctx: any) => ctx);
    expect(count).toBe(1);
    expect(api.on).toHaveBeenCalledWith("message_sending", expect.any(Function));
  });

  it("calls hookCtx on every invocation", async () => {
    const { api, handlers } = createMockApi();
    const hookCtx = vi.fn((ctx: any) => ({
      ...ctx,
      cfg: { plugins: { entries: { "prisma-airs": { config: { profile_name: "test" } } } } },
    }));
    registerResponseGuardHooks(api as any, hookCtx);
    mockScan.mockResolvedValue(allowResult() as any);
    await handlers["message_sending"]({ content: "hello" }, createMockCtx());
    expect(hookCtx).toHaveBeenCalledTimes(1);
  });

  it("returns void when AIRS allows", async () => {
    const { api, handlers } = createMockApi();
    registerResponseGuardHooks(api as any, (ctx: any) => ctx);
    mockScan.mockResolvedValue(allowResult() as any);
    const result = await handlers["message_sending"]({ content: "safe response" }, createMockCtx());
    expect(result).toBeUndefined();
  });

  it("returns block message when AIRS blocks", async () => {
    const { api, handlers } = createMockApi();
    registerResponseGuardHooks(api as any, (ctx: any) => ctx);
    mockScan.mockResolvedValue(blockResult() as any);
    const result = await handlers["message_sending"]({ content: "bad response" }, createMockCtx());
    expect(result).toHaveProperty("content");
    expect(result.content).toContain("security policy");
  });

  it("masks DLP-only violation when dlp_mask_only is true", async () => {
    const { api, handlers } = createMockApi();
    const hookCtx = (ctx: any) => ({
      ...ctx,
      cfg: { plugins: { entries: { "prisma-airs": { config: { dlp_mask_only: true } } } } },
    });
    registerResponseGuardHooks(api as any, hookCtx);
    mockScan.mockResolvedValue(dlpResult() as any);
    mockMask.mockReturnValue("masked content");
    const result = await handlers["message_sending"](
      { content: "has SSN 123-45-6789" },
      createMockCtx()
    );
    expect(result).toEqual({ content: "masked content" });
  });

  it("blocks DLP violation when dlp_mask_only is false", async () => {
    const { api, handlers } = createMockApi();
    const hookCtx = (ctx: any) => ({
      ...ctx,
      cfg: { plugins: { entries: { "prisma-airs": { config: { dlp_mask_only: false } } } } },
    });
    registerResponseGuardHooks(api as any, hookCtx);
    mockScan.mockResolvedValue(dlpResult() as any);
    const result = await handlers["message_sending"](
      { content: "has SSN 123-45-6789" },
      createMockCtx()
    );
    expect(result.content).toContain("security policy");
  });

  it("blocks on scan error when fail_closed", async () => {
    const { api, handlers } = createMockApi();
    const hookCtx = (ctx: any) => ({
      ...ctx,
      cfg: { plugins: { entries: { "prisma-airs": { config: { fail_closed: true } } } } },
    });
    registerResponseGuardHooks(api as any, hookCtx);
    mockScan.mockRejectedValue(new Error("AIRS unavailable"));
    const result = await handlers["message_sending"]({ content: "hello" }, createMockCtx());
    expect(result).toHaveProperty("content");
    expect(result.content).toContain("security verification");
  });

  it("returns void on scan error when fail_open", async () => {
    const { api, handlers } = createMockApi();
    const hookCtx = (ctx: any) => ({
      ...ctx,
      cfg: { plugins: { entries: { "prisma-airs": { config: { fail_closed: false } } } } },
    });
    registerResponseGuardHooks(api as any, hookCtx);
    mockScan.mockRejectedValue(new Error("AIRS unavailable"));
    const result = await handlers["message_sending"]({ content: "hello" }, createMockCtx());
    expect(result).toBeUndefined();
  });

  it("blocks on api_error result when fail_closed", async () => {
    const { api, handlers } = createMockApi();
    const hookCtx = (ctx: any) => ({
      ...ctx,
      cfg: { plugins: { entries: { "prisma-airs": { config: { fail_closed: true } } } } },
    });
    registerResponseGuardHooks(api as any, hookCtx);
    mockScan.mockResolvedValue({
      ...allowResult(),
      action: "warn",
      categories: ["api_error"],
      hasError: true,
      error: "SDK not initialized",
    } as any);
    const result = await handlers["message_sending"]({ content: "hello" }, createMockCtx());
    expect(result).toHaveProperty("content");
    expect(result.content).toContain("security verification");
  });

  it("returns void on api_error result when fail_open", async () => {
    const { api, handlers } = createMockApi();
    const hookCtx = (ctx: any) => ({
      ...ctx,
      cfg: { plugins: { entries: { "prisma-airs": { config: { fail_closed: false } } } } },
    });
    registerResponseGuardHooks(api as any, hookCtx);
    mockScan.mockResolvedValue({
      ...allowResult(),
      action: "warn",
      categories: ["api_error"],
      hasError: true,
      error: "SDK not initialized",
    } as any);
    const result = await handlers["message_sending"]({ content: "hello" }, createMockCtx());
    expect(result).toBeUndefined();
  });

  it("returns void when content is empty", async () => {
    const { api, handlers } = createMockApi();
    registerResponseGuardHooks(api as any, (ctx: any) => ctx);
    const result = await handlers["message_sending"]({ content: "" }, createMockCtx());
    expect(result).toBeUndefined();
    expect(mockScan).not.toHaveBeenCalled();
  });

  it("returns void when content is missing", async () => {
    const { api, handlers } = createMockApi();
    registerResponseGuardHooks(api as any, (ctx: any) => ctx);
    const result = await handlers["message_sending"]({}, createMockCtx());
    expect(result).toBeUndefined();
    expect(mockScan).not.toHaveBeenCalled();
  });
});
