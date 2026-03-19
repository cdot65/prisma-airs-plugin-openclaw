# Testing

Testing strategy, commands, and patterns for the Prisma AIRS plugin.

## Quick Reference

```bash
cd prisma-airs-plugin

npm test                # run tests once (vitest run)
npm run test:watch      # re-run on changes
npm run test:coverage   # with coverage report
npm run check           # typecheck + lint + format + tests
```

`npm run check` runs in order:

1. `npm run typecheck` -- `tsc --noEmit`
2. `npm run lint` -- ESLint
3. `npm run format:check` -- Prettier
4. `npm run test` -- `vitest run`

## Test File Locations

Tests live next to their source files:

```
prisma-airs-plugin/
├── src/
│   ├── scanner.ts
│   ├── scanner.test.ts
│   ├── scan-cache.ts
│   ├── scan-cache.test.ts
│   ├── config.ts
│   └── config.test.ts
└── hooks/
    ├── prisma-airs-guard/
    │   ├── handler.ts
    │   └── handler.test.ts
    ├── prisma-airs-audit/
    │   ├── handler.ts
    │   └── handler.test.ts
    ├── prisma-airs-context/
    │   └── handler.test.ts
    ├── prisma-airs-outbound/
    │   └── handler.test.ts
    ├── prisma-airs-tools/
    │   └── handler.test.ts
    ├── prisma-airs-inbound-block/
    │   └── handler.test.ts
    ├── prisma-airs-outbound-block/
    │   └── handler.test.ts
    ├── prisma-airs-tool-guard/
    │   └── handler.test.ts
    ├── prisma-airs-prompt-scan/
    │   └── handler.test.ts
    ├── prisma-airs-tool-redact/
    │   └── handler.test.ts
    ├── prisma-airs-llm-audit/
    │   └── handler.test.ts
    └── prisma-airs-tool-audit/
        └── handler.test.ts
```

Total: 15 test files, 164+ tests.

## Framework

[Vitest](https://vitest.dev/) with the following imports:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
```

## Mocking Patterns

### Scanner Tests: Mock the SDK

Scanner tests mock `@cdot65/prisma-airs-sdk` at the module level:

```typescript
vi.mock("@cdot65/prisma-airs-sdk", () => ({
  globalConfiguration: { initialized: true },
  Scanner: vi.fn().mockImplementation(() => ({
    syncScan: vi.fn().mockResolvedValue({
      scan_id: "scan_123",
      action: "allow",
      category: "benign",
    }),
  })),
  Content: vi.fn(),
  AISecSDKException: class extends Error {},
}));
```

### Hook Tests: Mock the Scanner Module

Hook tests mock `../../src/scanner`:

```typescript
vi.mock("../../src/scanner", () => ({
  scan: vi.fn().mockResolvedValue({
    action: "allow",
    severity: "SAFE",
    categories: ["safe"],
    scanId: "scan_123",
    reportId: "report_456",
    profileName: "default",
    promptDetected: {
      injection: false, dlp: false, urlCats: false,
      toxicContent: false, maliciousCode: false,
      agent: false, topicViolation: false,
    },
    responseDetected: {
      dlp: false, urlCats: false, dbSecurity: false,
      toxicContent: false, maliciousCode: false,
      agent: false, ungrounded: false, topicViolation: false,
    },
    latencyMs: 100,
    timeout: false,
    hasError: false,
    contentErrors: [],
  }),
}));
```

### Cache-Based Hook Tests: Mock the Scan Cache

Hooks that read from cache (tools, tool-redact) mock `../../src/scan-cache`:

```typescript
vi.mock("../../src/scan-cache", () => ({
  getCachedScanResult: vi.fn(),
  getCachedScanResultIfMatch: vi.fn(),
  cacheScanResult: vi.fn(),
  hashMessage: vi.fn().mockReturnValue("hash123"),
  clearScanResult: vi.fn(),
}));
```

### Outbound Test: Mock Factory for Helpers

Outbound handler tests need explicit mock factories for exported helper functions:

```typescript
vi.mock("../../src/scanner", () => {
  return {
    scan: vi.fn(),
    // Must include helpers used by the handler
  };
});
```

### Time Mocking for Cache TTL

```typescript
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

it("should expire after TTL", () => {
  cacheScanResult("session", result, "hash");
  vi.advanceTimersByTime(31_000); // past 30s TTL
  expect(getCachedScanResult("session")).toBeUndefined();
});
```

## Writing a Hook Test

Standard pattern:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import handler from "./handler";

// Mock dependencies
vi.mock("../../src/scanner", () => ({ scan: vi.fn() }));

describe("prisma-airs-<name>", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should skip when mode is off", async () => {
    const result = await handler(event, ctxWithMode("off"));
    expect(result).toBeUndefined();
  });

  it("should allow safe content", async () => {
    mockScanAllow();
    const result = await handler(event, ctx);
    expect(result).toBeUndefined();
  });

  it("should block threats", async () => {
    mockScanBlock();
    const result = await handler(event, ctx);
    expect(result).toHaveProperty("block", true);
  });
});
```

## Running Specific Tests

```bash
# Filter by test name
npm test -- --filter "should handle API error"

# Filter by file
npm test -- scanner.test.ts

# Verbose output
npm test -- --reporter=verbose
```

## Coverage

```bash
npm run test:coverage
open coverage/index.html
```

## E2E Smoke Tests

E2E tests run inside the Docker container against a live AIRS API:

```bash
# Start the gateway
export PANW_AI_SEC_API_KEY="your-key"
docker compose up -d --build

# Run smoke tests
docker compose exec gateway bash /home/node/e2e/smoke-test.sh
```

The smoke test (`e2e/smoke-test.sh`) verifies:

1. Plugin status is `ready`
2. API key is configured
3. Benign message returns `allow`
4. Scan returns `scanId` and `latencyMs`
5. Injection attempt returns `block`/`warn` with `prompt_injection` category

See the [Docker Guide](../guides/docker.md) for full setup details.

## Source Files

- Test framework config: `prisma-airs-plugin/vitest.config.ts`
- Package scripts: `prisma-airs-plugin/package.json`
- E2E tests: `e2e/smoke-test.sh`
