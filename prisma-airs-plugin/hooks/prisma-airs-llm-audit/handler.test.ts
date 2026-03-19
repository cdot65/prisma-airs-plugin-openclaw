/**
 * Tests for prisma-airs-llm-audit hook handler (llm_input + llm_output)
 *
 * Fire-and-forget hooks that scan LLM I/O through AIRS for audit logging.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import handler from "./handler";

// Mock the scanner module
vi.mock("../../src/scanner", () => ({
  scan: vi.fn(),
  defaultPromptDetected: () => ({
    injection: false,
    dlp: false,
    urlCats: false,
    toxicContent: false,
    maliciousCode: false,
    agent: false,
    topicViolation: false,
  }),
  defaultResponseDetected: () => ({
    dlp: false,
    urlCats: false,
    dbSecurity: false,
    toxicContent: false,
    maliciousCode: false,
    agent: false,
    ungrounded: false,
    topicViolation: false,
  }),
}));

import { scan, defaultPromptDetected, defaultResponseDetected } from "../../src/scanner.ts";
const mockScan = vi.mocked(scan);

describe("prisma-airs-llm-audit handler", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const allowResult = {
    action: "allow" as const,
    severity: "SAFE" as const,
    categories: ["safe"],
    scanId: "scan_123",
    reportId: "report_456",
    profileName: "default",
    promptDetected: defaultPromptDetected(),
    responseDetected: defaultResponseDetected(),
    latencyMs: 50,
    timeout: false,
    hasError: false,
    contentErrors: [],
  };

  const baseCtx = {
    agentId: "agent-1",
    sessionKey: "session-123",
    sessionId: "sid-abc",
    cfg: {
      plugins: {
        entries: {
          "prisma-airs": {
            config: {
              profile_name: "default",
              app_name: "test-app",
              llm_audit_mode: "deterministic",
            },
          },
        },
      },
    },
  };

  describe("llm_input event", () => {
    const inputEvent = {
      hookEvent: "llm_input" as const,
      runId: "run-1",
      sessionId: "sid-abc",
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      systemPrompt: "You are a helpful assistant.",
      prompt: "What is the weather today?",
      historyMessages: [],
      imagesCount: 0,
    };

    it("should scan prompt through AIRS", async () => {
      mockScan.mockResolvedValue(allowResult);
      await handler(inputEvent, baseCtx);
      expect(mockScan).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("What is the weather today?"),
          profileName: "default",
          appName: "test-app",
        })
      );
    });

    it("should include system prompt in scan content", async () => {
      mockScan.mockResolvedValue(allowResult);
      await handler(inputEvent, baseCtx);
      const scanCall = mockScan.mock.calls[0][0];
      expect(scanCall.prompt).toContain("You are a helpful assistant.");
    });

    it("should log audit entry with model info", async () => {
      mockScan.mockResolvedValue(allowResult);
      await handler(inputEvent, baseCtx);
      expect(logSpy).toHaveBeenCalled();
      const logCall = logSpy.mock.calls.find((c) => {
        const parsed = JSON.parse(c[0] as string);
        return parsed.event === "prisma_airs_llm_input_audit";
      });
      expect(logCall).toBeDefined();
      const entry = JSON.parse(logCall![0] as string);
      expect(entry.model).toBe("claude-sonnet-4-20250514");
      expect(entry.provider).toBe("anthropic");
      expect(entry.action).toBe("allow");
    });

    it("should log threat detection on non-allow", async () => {
      mockScan.mockResolvedValue({
        ...allowResult,
        action: "block",
        severity: "CRITICAL",
        categories: ["prompt_injection"],
      });
      await handler(inputEvent, baseCtx);
      const logCall = logSpy.mock.calls.find((c) => {
        const parsed = JSON.parse(c[0] as string);
        return parsed.event === "prisma_airs_llm_input_audit";
      });
      const entry = JSON.parse(logCall![0] as string);
      expect(entry.action).toBe("block");
      expect(entry.categories).toContain("prompt_injection");
    });
  });

  describe("llm_output event", () => {
    const outputEvent = {
      hookEvent: "llm_output" as const,
      runId: "run-1",
      sessionId: "sid-abc",
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      assistantTexts: ["The weather today is sunny.", "Temperature is 72F."],
      usage: {
        input: 100,
        output: 50,
        total: 150,
      },
    };

    it("should scan response through AIRS", async () => {
      mockScan.mockResolvedValue(allowResult);
      await handler(outputEvent, baseCtx);
      expect(mockScan).toHaveBeenCalledWith(
        expect.objectContaining({
          response: expect.stringContaining("The weather today is sunny."),
          profileName: "default",
          appName: "test-app",
        })
      );
    });

    it("should concatenate multiple assistant texts", async () => {
      mockScan.mockResolvedValue(allowResult);
      await handler(outputEvent, baseCtx);
      const scanCall = mockScan.mock.calls[0][0];
      expect(scanCall.response).toContain("Temperature is 72F.");
    });

    it("should log audit entry with usage info", async () => {
      mockScan.mockResolvedValue(allowResult);
      await handler(outputEvent, baseCtx);
      const logCall = logSpy.mock.calls.find((c) => {
        const parsed = JSON.parse(c[0] as string);
        return parsed.event === "prisma_airs_llm_output_audit";
      });
      expect(logCall).toBeDefined();
      const entry = JSON.parse(logCall![0] as string);
      expect(entry.usage).toEqual({ input: 100, output: 50, total: 150 });
    });

    it("should handle empty assistantTexts", async () => {
      const emptyEvent = { ...outputEvent, assistantTexts: [] };
      await handler(emptyEvent, baseCtx);
      expect(mockScan).not.toHaveBeenCalled();
    });
  });

  describe("disabled mode", () => {
    it("should skip scanning when llm_audit_mode is off", async () => {
      const ctxOff = {
        ...baseCtx,
        cfg: {
          plugins: {
            entries: {
              "prisma-airs": {
                config: {
                  ...baseCtx.cfg.plugins.entries["prisma-airs"].config,
                  llm_audit_mode: "off",
                },
              },
            },
          },
        },
      };
      const inputEvent = {
        hookEvent: "llm_input" as const,
        runId: "run-1",
        sessionId: "sid-abc",
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        prompt: "hello",
        historyMessages: [],
        imagesCount: 0,
      };
      await handler(inputEvent, ctxOff);
      expect(mockScan).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should log error on scan failure without throwing", async () => {
      mockScan.mockRejectedValue(new Error("API timeout"));
      const inputEvent = {
        hookEvent: "llm_input" as const,
        runId: "run-1",
        sessionId: "sid-abc",
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        prompt: "hello",
        historyMessages: [],
        imagesCount: 0,
      };
      // Should not throw
      await handler(inputEvent, baseCtx);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("unknown event type", () => {
    it("should skip unknown hookEvent types", async () => {
      const unknownEvent = {
        hookEvent: "unknown_event" as string,
        runId: "run-1",
        sessionId: "sid-abc",
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await handler(unknownEvent as any, baseCtx);
      expect(mockScan).not.toHaveBeenCalled();
    });
  });
});
