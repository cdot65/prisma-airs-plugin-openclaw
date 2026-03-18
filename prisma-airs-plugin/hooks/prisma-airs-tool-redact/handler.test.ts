/**
 * Tests for prisma-airs-tool-redact hook handler (tool_result_persist)
 *
 * This hook is SYNCHRONOUS — no async/await allowed.
 * Uses scan cache from tool-guard + regex masking for DLP redaction.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import handler from "./handler";

// Mock scan-cache module
vi.mock("../../src/scan-cache", () => ({
  getCachedScanResult: vi.fn(),
}));

// Mock scanner for defaultPromptDetected/defaultResponseDetected
vi.mock("../../src/scanner", () => ({
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

import { getCachedScanResult } from "../../src/scan-cache";
import { defaultPromptDetected, defaultResponseDetected } from "../../src/scanner";
const mockGetCached = vi.mocked(getCachedScanResult);

describe("prisma-airs-tool-redact handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const dlpResult = {
    action: "block" as const,
    severity: "HIGH" as const,
    categories: ["dlp_response"],
    scanId: "scan_dlp",
    reportId: "report_dlp",
    profileName: "default",
    promptDetected: defaultPromptDetected(),
    responseDetected: { ...defaultResponseDetected(), dlp: true },
    latencyMs: 30,
    timeout: false,
    hasError: false,
    contentErrors: [],
  };

  const allowResult = {
    action: "allow" as const,
    severity: "SAFE" as const,
    categories: ["safe"],
    scanId: "scan_ok",
    reportId: "report_ok",
    profileName: "default",
    promptDetected: defaultPromptDetected(),
    responseDetected: defaultResponseDetected(),
    latencyMs: 20,
    timeout: false,
    hasError: false,
    contentErrors: [],
  };

  const makeEvent = (text: string) => ({
    toolName: "Read",
    toolCallId: "call_123",
    message: {
      role: "toolResult" as const,
      toolCallId: "call_123",
      toolName: "Read",
      content: [{ type: "text" as const, text }],
      isError: false,
      timestamp: Date.now(),
    },
  });

  const baseCtx = {
    agentId: "agent-1",
    sessionKey: "session-123",
    toolName: "Read",
    toolCallId: "call_123",
    cfg: {
      plugins: {
        entries: {
          "prisma-airs": {
            config: {
              profile_name: "default",
              app_name: "test-app",
              fail_closed: true,
              tool_redact_mode: "deterministic",
            },
          },
        },
      },
    },
  };

  describe("handler is synchronous", () => {
    it("should return a non-Promise value", () => {
      mockGetCached.mockReturnValue(undefined);
      const result = handler(makeEvent("hello"), baseCtx);
      // Must NOT be a Promise
      expect(result).not.toBeInstanceOf(Promise);
    });
  });

  describe("regex masking without cache", () => {
    it("should redact SSNs in tool output", () => {
      mockGetCached.mockReturnValue(undefined);
      const event = makeEvent("User SSN is 123-45-6789");
      const result = handler(event, baseCtx);
      expect(result!.message!.content![0].text).toBe("User SSN is [SSN REDACTED]");
    });

    it("should redact credit card numbers", () => {
      mockGetCached.mockReturnValue(undefined);
      const event = makeEvent("Card: 4111-1111-1111-1111");
      const result = handler(event, baseCtx);
      expect(result!.message!.content![0].text).toContain("[CARD REDACTED]");
    });

    it("should redact email addresses", () => {
      mockGetCached.mockReturnValue(undefined);
      const event = makeEvent("Contact: user@example.com");
      const result = handler(event, baseCtx);
      expect(result!.message!.content![0].text).toContain("[EMAIL REDACTED]");
    });

    it("should redact API keys", () => {
      mockGetCached.mockReturnValue(undefined);
      const event = makeEvent("Key: sk-1234567890abcdef1234567890abcdef");
      const result = handler(event, baseCtx);
      expect(result!.message!.content![0].text).toContain("[API KEY REDACTED]");
    });

    it("should return undefined when no sensitive data found", () => {
      mockGetCached.mockReturnValue(undefined);
      const event = makeEvent("Hello world, nothing sensitive here");
      const result = handler(event, baseCtx);
      expect(result).toBeUndefined();
    });
  });

  describe("cache-enhanced behavior", () => {
    it("should apply masking when cache has DLP result", () => {
      mockGetCached.mockReturnValue(dlpResult);
      const event = makeEvent("User SSN is 123-45-6789");
      const result = handler(event, baseCtx);
      expect(result!.message!.content![0].text).toBe("User SSN is [SSN REDACTED]");
    });

    it("should still apply regex masking even when cache says allow", () => {
      mockGetCached.mockReturnValue(allowResult);
      const event = makeEvent("SSN: 123-45-6789");
      const result = handler(event, baseCtx);
      expect(result!.message!.content![0].text).toContain("[SSN REDACTED]");
    });
  });

  describe("message handling", () => {
    it("should handle empty content array", () => {
      mockGetCached.mockReturnValue(undefined);
      const event = {
        toolName: "Read",
        toolCallId: "call_123",
        message: {
          role: "toolResult" as const,
          toolCallId: "call_123",
          toolName: "Read",
          content: [],
          isError: false,
          timestamp: Date.now(),
        },
      };
      const result = handler(event, baseCtx);
      expect(result).toBeUndefined();
    });

    it("should handle multiple text content items", () => {
      mockGetCached.mockReturnValue(undefined);
      const event = {
        toolName: "Read",
        toolCallId: "call_123",
        message: {
          role: "toolResult" as const,
          toolCallId: "call_123",
          toolName: "Read",
          content: [
            { type: "text" as const, text: "SSN: 123-45-6789" },
            { type: "text" as const, text: "Card: 4111-1111-1111-1111" },
          ],
          isError: false,
          timestamp: Date.now(),
        },
      };
      const result = handler(event, baseCtx);
      expect(result!.message!.content![0].text).toContain("[SSN REDACTED]");
      expect(result!.message!.content![1].text).toContain("[CARD REDACTED]");
    });

    it("should preserve non-text content items unchanged", () => {
      mockGetCached.mockReturnValue(undefined);
      const event = {
        toolName: "Read",
        toolCallId: "call_123",
        message: {
          role: "toolResult" as const,
          toolCallId: "call_123",
          toolName: "Read",
          content: [
            { type: "image" as const, source: "data:image/png;base64,abc" },
            { type: "text" as const, text: "SSN: 123-45-6789" },
          ],
          isError: false,
          timestamp: Date.now(),
        },
      };
      const result = handler(event, baseCtx);
      expect(result!.message!.content![0]).toEqual({
        type: "image",
        source: "data:image/png;base64,abc",
      });
      expect(result!.message!.content![1].text).toContain("[SSN REDACTED]");
    });

    it("should skip synthetic results", () => {
      mockGetCached.mockReturnValue(undefined);
      const event = {
        ...makeEvent("SSN: 123-45-6789"),
        isSynthetic: true,
      };
      const result = handler(event, baseCtx);
      expect(result).toBeUndefined();
    });
  });

  describe("disabled mode", () => {
    it("should skip redaction when tool_redact_mode is off", () => {
      mockGetCached.mockReturnValue(undefined);
      const ctxOff = {
        ...baseCtx,
        cfg: {
          plugins: {
            entries: {
              "prisma-airs": {
                config: {
                  ...baseCtx.cfg.plugins.entries["prisma-airs"].config,
                  tool_redact_mode: "off",
                },
              },
            },
          },
        },
      };
      const event = makeEvent("SSN: 123-45-6789");
      const result = handler(event, ctxOff);
      expect(result).toBeUndefined();
    });
  });

  describe("error handling", () => {
    it("should not throw on malformed message", () => {
      mockGetCached.mockReturnValue(undefined);
      const event = { toolName: "Read", toolCallId: "x", message: {} };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = handler(event as any, baseCtx);
      expect(result).toBeUndefined();
    });
  });
});
