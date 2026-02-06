/**
 * Tests for prisma-airs-outbound hook handler
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

describe("prisma-airs-outbound handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console output during tests
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const baseEvent = {
    content: "This is a test response",
    to: "user@example.com",
    channel: "slack",
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
              outbound_scanning_enabled: true,
              profile_name: "default",
              app_name: "test-app",
              fail_closed: true,
              dlp_mask_only: true,
            },
          },
        },
      },
    },
  };

  describe("allow action", () => {
    it("should return undefined for allowed responses", async () => {
      mockScan.mockResolvedValue({
        action: "allow",
        severity: "SAFE",
        categories: ["safe"],
        scanId: "scan_123",
        reportId: "report_456",
        profileName: "default",
        promptDetected: defaultPromptDetected(),
        responseDetected: defaultResponseDetected(),
        latencyMs: 50,
      });

      const result = await handler(baseEvent, baseCtx);
      expect(result).toBeUndefined();
    });
  });

  describe("warn action", () => {
    it("should allow through with warning logged", async () => {
      mockScan.mockResolvedValue({
        action: "warn",
        severity: "MEDIUM",
        categories: ["url_filtering_response"],
        scanId: "scan_123",
        reportId: "report_456",
        profileName: "default",
        promptDetected: defaultPromptDetected(),
        responseDetected: { ...defaultResponseDetected(), urlCats: true },
        latencyMs: 50,
      });

      const result = await handler(baseEvent, baseCtx);
      expect(result).toBeUndefined();
      expect(console.log).toHaveBeenCalled();
    });
  });

  describe("block action - DLP masking", () => {
    it("should mask SSN in response", async () => {
      mockScan.mockResolvedValue({
        action: "block",
        severity: "HIGH",
        categories: ["dlp_response"],
        scanId: "scan_123",
        reportId: "report_456",
        profileName: "default",
        promptDetected: defaultPromptDetected(),
        responseDetected: { ...defaultResponseDetected(), dlp: true },
        latencyMs: 50,
      });

      const eventWithSSN = {
        ...baseEvent,
        content: "Your SSN is 123-45-6789",
      };

      const result = await handler(eventWithSSN, baseCtx);
      expect(result?.content).toContain("[SSN REDACTED]");
      expect(result?.content).not.toContain("123-45-6789");
    });

    it("should mask credit card numbers", async () => {
      mockScan.mockResolvedValue({
        action: "block",
        severity: "HIGH",
        categories: ["dlp_response"],
        scanId: "scan_123",
        reportId: "report_456",
        profileName: "default",
        promptDetected: defaultPromptDetected(),
        responseDetected: { ...defaultResponseDetected(), dlp: true },
        latencyMs: 50,
      });

      const eventWithCard = {
        ...baseEvent,
        content: "Your card number is 4111-1111-1111-1111",
      };

      const result = await handler(eventWithCard, baseCtx);
      expect(result?.content).toContain("[CARD REDACTED]");
    });

    it("should mask email addresses", async () => {
      mockScan.mockResolvedValue({
        action: "block",
        severity: "HIGH",
        categories: ["dlp_response"],
        scanId: "scan_123",
        reportId: "report_456",
        profileName: "default",
        promptDetected: defaultPromptDetected(),
        responseDetected: { ...defaultResponseDetected(), dlp: true },
        latencyMs: 50,
      });

      const eventWithEmail = {
        ...baseEvent,
        content: "Contact us at secret@company.com",
      };

      const result = await handler(eventWithEmail, baseCtx);
      expect(result?.content).toContain("[EMAIL REDACTED]");
    });
  });

  describe("block action - full block", () => {
    it("should block responses with malicious code", async () => {
      mockScan.mockResolvedValue({
        action: "block",
        severity: "CRITICAL",
        categories: ["malicious_code"],
        scanId: "scan_123",
        reportId: "report_456",
        profileName: "default",
        promptDetected: defaultPromptDetected(),
        responseDetected: defaultResponseDetected(),
        latencyMs: 50,
      });

      const result = await handler(baseEvent, baseCtx);
      expect(result?.content).toContain("security policy");
      expect(result?.content).toContain("malicious code");
    });

    it("should block responses with toxicity", async () => {
      mockScan.mockResolvedValue({
        action: "block",
        severity: "HIGH",
        categories: ["toxicity"],
        scanId: "scan_123",
        reportId: "report_456",
        profileName: "default",
        promptDetected: defaultPromptDetected(),
        responseDetected: defaultResponseDetected(),
        latencyMs: 50,
      });

      const result = await handler(baseEvent, baseCtx);
      expect(result?.content).toContain("security policy");
    });

    it("should block even DLP violations when combined with other threats", async () => {
      mockScan.mockResolvedValue({
        action: "block",
        severity: "CRITICAL",
        categories: ["dlp_response", "malicious_code"],
        scanId: "scan_123",
        reportId: "report_456",
        profileName: "default",
        promptDetected: defaultPromptDetected(),
        responseDetected: { ...defaultResponseDetected(), dlp: true },
        latencyMs: 50,
      });

      const eventWithSSN = {
        ...baseEvent,
        content: "Your SSN is 123-45-6789",
      };

      const result = await handler(eventWithSSN, baseCtx);
      // Should be a full block, not masking
      expect(result?.content).toContain("security policy");
      expect(result?.content).not.toContain("[SSN REDACTED]");
    });
  });

  describe("fail-closed behavior", () => {
    it("should block on scan failure when fail_closed is true", async () => {
      mockScan.mockRejectedValue(new Error("API timeout"));

      const result = await handler(baseEvent, baseCtx);
      expect(result?.content).toContain("security verification issue");
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
                  ...baseCtx.cfg?.plugins?.entries?.["prisma-airs"]?.config,
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

  describe("disabled scanning", () => {
    it("should skip scanning when disabled", async () => {
      const ctxDisabled = {
        ...baseCtx,
        cfg: {
          plugins: {
            entries: {
              "prisma-airs": {
                config: {
                  outbound_scanning_enabled: false,
                },
              },
            },
          },
        },
      };

      const result = await handler(baseEvent, ctxDisabled);
      expect(result).toBeUndefined();
      expect(mockScan).not.toHaveBeenCalled();
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
});
