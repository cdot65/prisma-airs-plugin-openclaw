/**
 * Tests for prisma-airs-prompt-scan hook handler (before_prompt_build)
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

describe("prisma-airs-prompt-scan handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
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

  const baseEvent = {
    prompt: "What is the weather today?",
    messages: [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there!" },
      { role: "user", content: "What is the weather today?" },
    ],
  };

  const baseCtx = {
    agentId: "agent-1",
    sessionKey: "session-123",
    cfg: {
      plugins: {
        entries: {
          "prisma-airs": {
            config: {
              profile_name: "default",
              app_name: "test-app",
              fail_closed: true,
              prompt_scan_mode: "deterministic",
            },
          },
        },
      },
    },
  };

  describe("allow action", () => {
    it("should return undefined for safe context", async () => {
      mockScan.mockResolvedValue(allowResult);

      const result = await handler(baseEvent, baseCtx);
      expect(result).toBeUndefined();
      expect(mockScan).toHaveBeenCalledTimes(1);
    });
  });

  describe("threat detection", () => {
    it("should inject prependSystemContext on block action", async () => {
      mockScan.mockResolvedValue({
        ...allowResult,
        action: "block",
        severity: "CRITICAL",
        categories: ["prompt_injection"],
      });

      const result = await handler(baseEvent, baseCtx);
      expect(result?.prependSystemContext).toBeDefined();
      expect(result?.prependSystemContext).toContain("SECURITY");
      expect(result?.prependSystemContext).toContain("prompt injection");
    });

    it("should inject prependSystemContext on warn action", async () => {
      mockScan.mockResolvedValue({
        ...allowResult,
        action: "warn",
        severity: "MEDIUM",
        categories: ["topic_violation_prompt"],
      });

      const result = await handler(baseEvent, baseCtx);
      expect(result?.prependSystemContext).toBeDefined();
      expect(result?.prependSystemContext).toContain("SECURITY");
    });
  });

  describe("context assembly", () => {
    it("should scan with assembled context from messages", async () => {
      mockScan.mockResolvedValue(allowResult);

      await handler(baseEvent, baseCtx);

      const scanCall = mockScan.mock.calls[0][0];
      expect(scanCall.prompt).toContain("Hello");
      expect(scanCall.prompt).toContain("Hi there!");
      expect(scanCall.prompt).toContain("What is the weather today?");
    });

    it("should use event.prompt when no messages array", async () => {
      mockScan.mockResolvedValue(allowResult);

      const eventNoMessages = { prompt: "standalone question" };
      await handler(eventNoMessages, baseCtx);

      const scanCall = mockScan.mock.calls[0][0];
      expect(scanCall.prompt).toBe("standalone question");
    });

    it("should skip when no prompt and no messages", async () => {
      const emptyEvent = {};
      const result = await handler(emptyEvent, baseCtx);
      expect(result).toBeUndefined();
      expect(mockScan).not.toHaveBeenCalled();
    });
  });

  describe("fail-closed behavior", () => {
    it("should inject warning on scan failure when fail_closed is true", async () => {
      mockScan.mockRejectedValue(new Error("API timeout"));

      const result = await handler(baseEvent, baseCtx);
      expect(result?.prependSystemContext).toBeDefined();
      expect(result?.prependSystemContext).toContain("scan failed");
    });

    it("should return undefined on scan failure when fail_closed is false", async () => {
      mockScan.mockRejectedValue(new Error("API timeout"));

      const ctxFailOpen = {
        ...baseCtx,
        cfg: {
          plugins: {
            entries: {
              "prisma-airs": {
                config: {
                  ...baseCtx.cfg.plugins.entries["prisma-airs"].config,
                  fail_closed: false,
                },
              },
            },
          },
        },
      };

      const result = await handler(baseEvent, ctxFailOpen);
      expect(result).toBeUndefined();
    });
  });

  describe("disabled mode", () => {
    it("should skip scanning when prompt_scan_mode is off", async () => {
      const ctxOff = {
        ...baseCtx,
        cfg: {
          plugins: {
            entries: {
              "prisma-airs": {
                config: {
                  ...baseCtx.cfg.plugins.entries["prisma-airs"].config,
                  prompt_scan_mode: "off",
                },
              },
            },
          },
        },
      };

      const result = await handler(baseEvent, ctxOff);
      expect(result).toBeUndefined();
      expect(mockScan).not.toHaveBeenCalled();
    });
  });

  describe("scan request", () => {
    it("should pass correct profile and app name", async () => {
      mockScan.mockResolvedValue(allowResult);

      await handler(baseEvent, baseCtx);

      expect(mockScan).toHaveBeenCalledWith(
        expect.objectContaining({
          profileName: "default",
          appName: "test-app",
        })
      );
    });
  });
});
