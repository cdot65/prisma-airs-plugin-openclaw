/**
 * Tests for scan-cache module
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  cacheScanResult,
  getCachedScanResult,
  getCachedScanResultIfMatch,
  clearScanResult,
  getCacheStats,
  hashMessage,
  stopCleanup,
  startCleanup,
} from "./scan-cache";
import { defaultPromptDetected, defaultResponseDetected } from "./scanner";
import type { ScanResult } from "./scanner";

// Mock scan result
const mockScanResult: ScanResult = {
  action: "block",
  severity: "HIGH",
  categories: ["prompt_injection"],
  scanId: "scan_123",
  reportId: "report_456",
  profileName: "default",
  promptDetected: { ...defaultPromptDetected(), injection: true },
  responseDetected: defaultResponseDetected(),
  latencyMs: 100,
};

describe("scan-cache", () => {
  beforeEach(() => {
    // Clear cache before each test
    clearScanResult("test-session");
    clearScanResult("session-1");
    clearScanResult("session-2");
  });

  afterEach(() => {
    // Stop cleanup interval to prevent test interference
    stopCleanup();
  });

  describe("cacheScanResult", () => {
    it("should cache a scan result", () => {
      cacheScanResult("test-session", mockScanResult);
      const result = getCachedScanResult("test-session");
      expect(result).toEqual(mockScanResult);
    });

    it("should cache with message hash", () => {
      const hash = hashMessage("test message");
      cacheScanResult("test-session", mockScanResult, hash);
      const result = getCachedScanResultIfMatch("test-session", hash);
      expect(result).toEqual(mockScanResult);
    });
  });

  describe("getCachedScanResult", () => {
    it("should return undefined for non-existent key", () => {
      const result = getCachedScanResult("non-existent");
      expect(result).toBeUndefined();
    });

    it("should return cached result", () => {
      cacheScanResult("test-session", mockScanResult);
      const result = getCachedScanResult("test-session");
      expect(result).toEqual(mockScanResult);
    });

    it("should return undefined for expired entries", () => {
      // Mock Date.now to simulate time passing
      const originalNow = Date.now;
      const startTime = 1000000;
      vi.spyOn(Date, "now").mockReturnValue(startTime);

      cacheScanResult("test-session", mockScanResult);

      // Advance time past TTL (30 seconds)
      vi.spyOn(Date, "now").mockReturnValue(startTime + 31000);

      const result = getCachedScanResult("test-session");
      expect(result).toBeUndefined();

      // Restore
      Date.now = originalNow;
    });
  });

  describe("getCachedScanResultIfMatch", () => {
    it("should return result if hash matches", () => {
      const hash = hashMessage("test message");
      cacheScanResult("test-session", mockScanResult, hash);
      const result = getCachedScanResultIfMatch("test-session", hash);
      expect(result).toEqual(mockScanResult);
    });

    it("should return undefined if hash does not match", () => {
      const hash1 = hashMessage("message 1");
      const hash2 = hashMessage("message 2");
      cacheScanResult("test-session", mockScanResult, hash1);
      const result = getCachedScanResultIfMatch("test-session", hash2);
      expect(result).toBeUndefined();
    });

    it("should return result if no hash was stored", () => {
      cacheScanResult("test-session", mockScanResult);
      const result = getCachedScanResultIfMatch("test-session", "any-hash");
      expect(result).toEqual(mockScanResult);
    });
  });

  describe("clearScanResult", () => {
    it("should clear cached result", () => {
      cacheScanResult("test-session", mockScanResult);
      clearScanResult("test-session");
      const result = getCachedScanResult("test-session");
      expect(result).toBeUndefined();
    });

    it("should not affect other sessions", () => {
      cacheScanResult("session-1", mockScanResult);
      cacheScanResult("session-2", { ...mockScanResult, scanId: "scan_456" });
      clearScanResult("session-1");

      expect(getCachedScanResult("session-1")).toBeUndefined();
      expect(getCachedScanResult("session-2")).toBeDefined();
    });
  });

  describe("hashMessage", () => {
    it("should produce consistent hashes", () => {
      const hash1 = hashMessage("test message");
      const hash2 = hashMessage("test message");
      expect(hash1).toEqual(hash2);
    });

    it("should produce different hashes for different messages", () => {
      const hash1 = hashMessage("message 1");
      const hash2 = hashMessage("message 2");
      expect(hash1).not.toEqual(hash2);
    });

    it("should handle empty string", () => {
      const hash = hashMessage("");
      expect(hash).toEqual("0");
    });
  });

  describe("getCacheStats", () => {
    it("should return cache stats", () => {
      const stats = getCacheStats();
      expect(stats).toHaveProperty("size");
      expect(stats).toHaveProperty("ttlMs");
      expect(stats.ttlMs).toEqual(30000);
    });
  });

  describe("cleanup", () => {
    it("should be able to stop and start cleanup", () => {
      stopCleanup();
      startCleanup();
      // No error means success
      expect(true).toBe(true);
    });
  });
});
