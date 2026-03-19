/**
 * Tests for prisma-airs-tool-guard hook handler
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

describe("prisma-airs-tool-guard handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const baseEvent = {
    toolName: "read_file",
    toolId: "tool-123",
    serverName: "filesystem",
    params: { path: "/etc/passwd" },
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
              tool_guard_mode: "deterministic",
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
    it("should not block allowed tool calls", async () => {
      mockScan.mockResolvedValue(allowResult);

      const result = await handler(baseEvent, baseCtx);
      expect(result).toBeUndefined();
      expect(mockScan).toHaveBeenCalledTimes(1);
    });
  });

  describe("block action", () => {
    it("should block tool calls with block action", async () => {
      mockScan.mockResolvedValue({
        ...allowResult,
        action: "block",
        severity: "CRITICAL",
        categories: ["malicious_code_prompt"],
      });

      const result = await handler(baseEvent, baseCtx);
      expect(result?.block).toBe(true);
      expect(result?.blockReason).toContain("read_file");
      expect(result?.blockReason).toContain("malicious_code_prompt");
    });

    it("should block tool calls with warn action", async () => {
      mockScan.mockResolvedValue({
        ...allowResult,
        action: "warn",
        severity: "MEDIUM",
        categories: ["agent_threat_prompt"],
      });

      const result = await handler(baseEvent, baseCtx);
      expect(result?.block).toBe(true);
    });
  });

  describe("tool event construction", () => {
    it("should pass toolEvents with metadata to scan", async () => {
      mockScan.mockResolvedValue(allowResult);

      await handler(baseEvent, baseCtx);

      expect(mockScan).toHaveBeenCalledWith(
        expect.objectContaining({
          toolEvents: [
            expect.objectContaining({
              metadata: expect.objectContaining({
                ecosystem: "mcp",
                method: "tool_call",
                serverName: "filesystem",
                toolInvoked: "read_file",
              }),
              input: JSON.stringify({ path: "/etc/passwd" }),
            }),
          ],
        })
      );
    });

    it("should use 'unknown' for missing server name", async () => {
      mockScan.mockResolvedValue(allowResult);
      const eventNoServer = { ...baseEvent, serverName: undefined };

      await handler(eventNoServer, baseCtx);

      expect(mockScan).toHaveBeenCalledWith(
        expect.objectContaining({
          toolEvents: [
            expect.objectContaining({
              metadata: expect.objectContaining({
                serverName: "unknown",
              }),
            }),
          ],
        })
      );
    });
  });

  describe("empty tool name", () => {
    it("should skip when no tool name", async () => {
      const noToolEvent = { ...baseEvent, toolName: "" };
      const result = await handler(noToolEvent, baseCtx);
      expect(result).toBeUndefined();
      expect(mockScan).not.toHaveBeenCalled();
    });
  });

  describe("fail-closed behavior", () => {
    it("should block on scan failure when fail_closed is true", async () => {
      mockScan.mockRejectedValue(new Error("API timeout"));

      const result = await handler(baseEvent, baseCtx);
      expect(result?.block).toBe(true);
      expect(result?.blockReason).toContain("security scan failed");
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
    it("should skip scanning when tool_guard_mode is off", async () => {
      const ctxOff = {
        ...baseCtx,
        cfg: {
          plugins: {
            entries: {
              "prisma-airs": {
                config: {
                  ...baseCtx.cfg.plugins.entries["prisma-airs"].config,
                  tool_guard_mode: "off",
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
});
