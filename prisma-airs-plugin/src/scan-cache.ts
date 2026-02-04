/**
 * Scan Cache - Share scan results between hooks
 *
 * Used to pass results from message_received (async/fire-and-forget)
 * to before_agent_start (can inject context).
 *
 * Note: Race condition possible since message_received is async.
 * Consumers should fallback to scanning if cache miss.
 */

import type { ScanResult } from "./scanner";

interface CacheEntry {
  result: ScanResult;
  timestamp: number;
  messageHash?: string;
}

const cache = new Map<string, CacheEntry>();
const TTL_MS = 30_000; // 30 seconds

/**
 * Cache a scan result for a session
 */
export function cacheScanResult(
  sessionKey: string,
  result: ScanResult,
  messageHash?: string
): void {
  cache.set(sessionKey, {
    result,
    timestamp: Date.now(),
    messageHash,
  });
}

/**
 * Get cached scan result for a session
 * Returns undefined if not found or expired
 */
export function getCachedScanResult(sessionKey: string): ScanResult | undefined {
  const entry = cache.get(sessionKey);
  if (!entry) return undefined;

  // Check TTL
  if (Date.now() - entry.timestamp > TTL_MS) {
    cache.delete(sessionKey);
    return undefined;
  }

  return entry.result;
}

/**
 * Get cached scan result only if message hash matches
 * Prevents using stale results from previous messages
 */
export function getCachedScanResultIfMatch(
  sessionKey: string,
  messageHash: string
): ScanResult | undefined {
  const entry = cache.get(sessionKey);
  if (!entry) return undefined;

  // Check TTL
  if (Date.now() - entry.timestamp > TTL_MS) {
    cache.delete(sessionKey);
    return undefined;
  }

  // Check message hash matches
  if (entry.messageHash && entry.messageHash !== messageHash) {
    return undefined;
  }

  return entry.result;
}

/**
 * Clear cached scan result for a session
 */
export function clearScanResult(sessionKey: string): void {
  cache.delete(sessionKey);
}

/**
 * Get cache stats for debugging
 */
export function getCacheStats(): { size: number; ttlMs: number } {
  return { size: cache.size, ttlMs: TTL_MS };
}

/**
 * Simple hash function for message content
 * Used to detect if cached result is for the same message
 */
export function hashMessage(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(16);
}

// Cleanup old entries periodically
// eslint-disable-next-line no-undef
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

export function startCleanup(): void {
  if (cleanupInterval) return;
  // eslint-disable-next-line no-undef
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of cache.entries()) {
      if (now - entry.timestamp > TTL_MS) {
        cache.delete(key);
      }
    }
  }, 60_000);
}

// Allow cleanup interval to be cleared for testing
export function stopCleanup(): void {
  if (cleanupInterval) {
    // eslint-disable-next-line no-undef
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

// Auto-start cleanup
startCleanup();
