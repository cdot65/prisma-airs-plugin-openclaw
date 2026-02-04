# Testing

Guide to testing the Prisma AIRS plugin.

## Running Tests

### Basic Commands

```bash
cd prisma-airs-plugin

# Run tests once
npm test

# Watch mode (re-run on changes)
npm run test:watch

# With coverage report
npm run test:coverage
```

### Full Check Suite

```bash
npm run check
```

Runs in order:

1. TypeScript type checking (`npm run typecheck`)
2. ESLint (`npm run lint`)
3. Prettier (`npm run format:check`)
4. Tests (`npm test`)

## Test Structure

### Directory Layout

```
prisma-airs-plugin/
├── src/
│   ├── scanner.ts
│   ├── scanner.test.ts        # Scanner unit tests
│   ├── scan-cache.ts
│   └── scan-cache.test.ts     # Cache unit tests
└── hooks/
    ├── prisma-airs-guard/
    │   ├── handler.ts
    │   └── handler.test.ts    # Hook unit tests
    └── ... other hooks
```

### Test File Naming

- Place tests next to source files
- Name: `{source}.test.ts`

## Writing Tests

### Basic Test

```typescript
import { describe, it, expect } from "vitest";
import { scan } from "./scanner";

describe("scan", () => {
  it("should return result for valid input", async () => {
    const result = await scan({ prompt: "hello" });
    expect(result).toBeDefined();
    expect(result.action).toBeDefined();
  });
});
```

### Mocking fetch

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch globally
global.fetch = vi.fn();

describe("scan", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should handle successful API response", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        scan_id: "scan_123",
        action: "allow",
        category: "benign",
      }),
    } as Response);

    const result = await scan({ prompt: "test" });

    expect(result.action).toBe("allow");
    expect(result.scanId).toBe("scan_123");
  });

  it("should handle API error", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    } as Response);

    const result = await scan({ prompt: "test" });

    expect(result.action).toBe("warn");
    expect(result.error).toContain("API error 500");
  });
});
```

### Mocking Environment Variables

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("scan with API key", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should return error when API key missing", async () => {
    delete process.env.PANW_AI_SEC_API_KEY;

    const { scan } = await import("./scanner");
    const result = await scan({ prompt: "test" });

    expect(result.error).toBe("PANW_AI_SEC_API_KEY not set");
  });

  it("should call API when key present", async () => {
    process.env.PANW_AI_SEC_API_KEY = "test-key";

    const { scan } = await import("./scanner");
    await scan({ prompt: "test" });

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-pan-token": "test-key",
        }),
      })
    );
  });
});
```

### Testing Cache

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  cacheScanResult,
  getCachedScanResult,
  clearScanResult,
} from './scan-cache';

describe('scan-cache', () => {
  beforeEach(() => {
    clearScanResult('test-session');
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should cache and retrieve result', () => {
    const result = { action: 'allow', ... };
    cacheScanResult('test-session', result);

    const cached = getCachedScanResult('test-session');
    expect(cached).toEqual(result);
  });

  it('should expire after TTL', () => {
    const result = { action: 'allow', ... };
    cacheScanResult('test-session', result);

    // Advance time past TTL (30 seconds)
    vi.advanceTimersByTime(31_000);

    const cached = getCachedScanResult('test-session');
    expect(cached).toBeUndefined();
  });
});
```

### Testing Hooks

```typescript
import { describe, it, expect, vi } from "vitest";
import handler from "./handler";

describe("prisma-airs-context", () => {
  it("should inject warning when threat detected", async () => {
    // Mock cache to return threat
    vi.mock("../../src/scan-cache", () => ({
      getCachedScanResultIfMatch: () => ({
        action: "block",
        categories: ["prompt_injection"],
      }),
      cacheScanResult: vi.fn(),
      hashMessage: () => "hash123",
    }));

    const event = {
      message: { content: "malicious input" },
    };
    const ctx = { conversationId: "conv-123" };

    const result = await handler(event, ctx);

    expect(result.prependContext).toContain("CRITICAL SECURITY ALERT");
    expect(result.prependContext).toContain("prompt_injection");
  });

  it("should return nothing for safe content", async () => {
    vi.mock("../../src/scan-cache", () => ({
      getCachedScanResultIfMatch: () => ({
        action: "allow",
        severity: "SAFE",
        categories: ["safe"],
      }),
      clearScanResult: vi.fn(),
      hashMessage: () => "hash123",
    }));

    const event = { message: { content: "hello" } };
    const ctx = { conversationId: "conv-123" };

    const result = await handler(event, ctx);

    expect(result).toBeUndefined();
  });
});
```

## Test Categories

### Unit Tests

Test individual functions in isolation.

```typescript
// scanner.test.ts
describe("parseResponse", () => {
  it("should map AIRS response to ScanResult", () => {
    const result = parseResponse(airsResponse, request, 100);
    expect(result.action).toBe("block");
  });
});
```

### Integration Tests

Test multiple components together.

```typescript
// Test cache + handler
describe("context hook with cache", () => {
  it("should use cached result from audit hook", async () => {
    // Simulate audit hook caching
    cacheScanResult("session", scanResult, "hash");

    // Run context hook
    const result = await contextHandler(event, ctx);

    // Verify it used cached result
    expect(result.prependContext).toContain("ALERT");
  });
});
```

### Edge Cases

```typescript
describe("edge cases", () => {
  it("should handle empty content", async () => {
    const result = await handler({ content: "" }, ctx);
    expect(result).toBeUndefined();
  });

  it("should handle null message", async () => {
    const result = await handler({ message: null }, ctx);
    expect(result).toBeUndefined();
  });

  it("should handle unicode content", async () => {
    const result = await handler({ content: "你好 🎉" }, ctx);
    expect(result).toBeDefined();
  });
});
```

## Coverage

### Run Coverage Report

```bash
npm run test:coverage
```

### Coverage Targets

| Metric     | Target |
| ---------- | ------ |
| Statements | 80%    |
| Branches   | 75%    |
| Functions  | 80%    |
| Lines      | 80%    |

### View Coverage

```bash
# Terminal summary
npm run test:coverage

# HTML report
open coverage/index.html
```

## Debugging Tests

### Run Single Test

```bash
npm test -- --filter "should handle API error"
```

### Debug Mode

```bash
npm test -- --reporter=verbose
```

### Watch Specific File

```bash
npm run test:watch -- scanner.test.ts
```
