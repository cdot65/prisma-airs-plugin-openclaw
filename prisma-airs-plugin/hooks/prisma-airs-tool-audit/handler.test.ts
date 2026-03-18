/**
 * Tests for prisma-airs-tool-audit hook handler (after_tool_call)
 *
 * Fire-and-forget hook that scans tool outputs through AIRS for audit logging.
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

import { scan, defaultPromptDetected, defaultResponseDetected } from "../../src/scanner";
const mockScan = vi.mocked(scan);

describe("prisma-airs-tool-audit handler", () => {
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
              tool_audit_mode: "deterministic",
            },
          },
        },
      },
    },
  };

  const baseEvent = {
    toolName: "Read",
    params: { file_path: "/etc/passwd" },
    result: "root:x:0:0:root:/root:/bin/bash",
    durationMs: 15,
  };

  describe("successful scan", () => {
    it("should scan tool result through AIRS", async () => {
      mockScan.mockResolvedValue(allowResult);
      await handler(baseEvent, baseCtx);
      expect(mockScan).toHaveBeenCalledWith(
        expect.objectContaining({
          response: expect.stringContaining("root:x:0:0"),
          profileName: "default",
          appName: "test-app",
        })
      );
    });

    it("should include toolEvents in scan request", async () => {
      mockScan.mockResolvedValue(allowResult);
      await handler(baseEvent, baseCtx);
      const scanCall = mockScan.mock.calls[0][0];
      expect(scanCall.toolEvents).toBeDefined();
      expect(scanCall.toolEvents![0].metadata.toolInvoked).toBe("Read");
    });

    it("should log audit entry with tool metadata", async () => {
      mockScan.mockResolvedValue(allowResult);
      await handler(baseEvent, baseCtx);
      const logCall = logSpy.mock.calls.find((c) => {
        const parsed = JSON.parse(c[0] as string);
        return parsed.event === "prisma_airs_tool_output_audit";
      });
      expect(logCall).toBeDefined();
      const entry = JSON.parse(logCall![0] as string);
      expect(entry.toolName).toBe("Read");
      expect(entry.durationMs).toBe(15);
      expect(entry.action).toBe("allow");
    });

    it("should log threat on non-allow result", async () => {
      mockScan.mockResolvedValue({
        ...allowResult,
        action: "block",
        severity: "HIGH",
        categories: ["dlp_response"],
      });
      await handler(baseEvent, baseCtx);
      const logCall = logSpy.mock.calls.find((c) => {
        const parsed = JSON.parse(c[0] as string);
        return parsed.event === "prisma_airs_tool_output_audit";
      });
      const entry = JSON.parse(logCall![0] as string);
      expect(entry.action).toBe("block");
      expect(entry.categories).toContain("dlp_response");
    });
  });

  describe("result serialization", () => {
    it("should handle object results", async () => {
      mockScan.mockResolvedValue(allowResult);
      const event = { ...baseEvent, result: { data: "value", count: 42 } };
      await handler(event, baseCtx);
      const scanCall = mockScan.mock.calls[0][0];
      expect(scanCall.response).toContain("value");
    });

    it("should handle undefined result (error case)", async () => {
      const event = { ...baseEvent, result: undefined, error: "File not found" };
      await handler(event, baseCtx);
      expect(mockScan).not.toHaveBeenCalled();
    });

    it("should handle null result", async () => {
      const event = { ...baseEvent, result: null };
      await handler(event, baseCtx);
      expect(mockScan).not.toHaveBeenCalled();
    });
  });

  describe("disabled mode", () => {
    it("should skip scanning when tool_audit_mode is off", async () => {
      const ctxOff = {
        ...baseCtx,
        cfg: {
          plugins: {
            entries: {
              "prisma-airs": {
                config: {
                  ...baseCtx.cfg.plugins.entries["prisma-airs"].config,
                  tool_audit_mode: "off",
                },
              },
            },
          },
        },
      };
      await handler(baseEvent, ctxOff);
      expect(mockScan).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should log error on scan failure without throwing", async () => {
      mockScan.mockRejectedValue(new Error("API timeout"));
      await handler(baseEvent, baseCtx);
      expect(console.error).toHaveBeenCalled();
    });
  });
});
