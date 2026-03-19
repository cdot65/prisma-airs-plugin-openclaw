/**
 * Tests for prisma-airs-outbound-block hook handler
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

describe("prisma-airs-outbound-block handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const baseEvent = {
    content: "Here is the information you requested.",
    role: "assistant" as const,
    metadata: {
      sessionKey: "test-session",
    },
  };

  const baseCtx = {
    channelId: "slack",
    conversationId: "conv-123",
    cfg: {
      plugins: {
        entries: {
          "prisma-airs": {
            config: {
              profile_name: "default",
              app_name: "test-app",
              fail_closed: true,
              outbound_block_mode: "deterministic",
            },
          },
        },
      },
    },
  };

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

  describe("allow action", () => {
    it("should not block allowed messages", async () => {
      mockScan.mockResolvedValue(allowResult);

      const result = await handler(baseEvent, baseCtx);
      expect(result).toBeUndefined();
      expect(mockScan).toHaveBeenCalledTimes(1);
    });
  });

  describe("block action", () => {
    it("should block messages with block action", async () => {
      mockScan.mockResolvedValue({
        ...allowResult,
        action: "block",
        severity: "CRITICAL",
        categories: ["malicious_code_response"],
      });

      const result = await handler(baseEvent, baseCtx);
      expect(result).toEqual({ block: true });
    });

    it("should block messages with warn action", async () => {
      mockScan.mockResolvedValue({
        ...allowResult,
        action: "warn",
        severity: "MEDIUM",
        categories: ["toxic_content_response"],
      });

      const result = await handler(baseEvent, baseCtx);
      expect(result).toEqual({ block: true });
    });
  });

  describe("role filtering", () => {
    it("should skip user messages", async () => {
      const userEvent = { ...baseEvent, role: "user" as const };

      const result = await handler(userEvent, baseCtx);
      expect(result).toBeUndefined();
      expect(mockScan).not.toHaveBeenCalled();
    });

    it("should scan assistant messages", async () => {
      mockScan.mockResolvedValue(allowResult);

      await handler(baseEvent, baseCtx);
      expect(mockScan).toHaveBeenCalledTimes(1);
    });
  });

  describe("empty content", () => {
    it("should skip empty content", async () => {
      const emptyEvent = { ...baseEvent, content: "" };
      const result = await handler(emptyEvent, baseCtx);
      expect(result).toBeUndefined();
      expect(mockScan).not.toHaveBeenCalled();
    });

    it("should skip undefined content", async () => {
      const noContentEvent = { ...baseEvent, content: undefined };
      const result = await handler(noContentEvent, baseCtx);
      expect(result).toBeUndefined();
      expect(mockScan).not.toHaveBeenCalled();
    });
  });

  describe("fail-closed behavior", () => {
    it("should block on scan failure when fail_closed is true", async () => {
      mockScan.mockRejectedValue(new Error("API timeout"));

      const result = await handler(baseEvent, baseCtx);
      expect(result).toEqual({ block: true });
    });

    it("should allow through on scan failure when fail_closed is false", async () => {
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
    it("should skip scanning when outbound_block_mode is off", async () => {
      const ctxOff = {
        ...baseCtx,
        cfg: {
          plugins: {
            entries: {
              "prisma-airs": {
                config: {
                  ...baseCtx.cfg.plugins.entries["prisma-airs"].config,
                  outbound_block_mode: "off",
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
    it("should scan with response field from message content", async () => {
      mockScan.mockResolvedValue(allowResult);

      await handler(baseEvent, baseCtx);

      expect(mockScan).toHaveBeenCalledWith(
        expect.objectContaining({
          response: "Here is the information you requested.",
          profileName: "default",
          appName: "test-app",
        })
      );
    });
  });
});
