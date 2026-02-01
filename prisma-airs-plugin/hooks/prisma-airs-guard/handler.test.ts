/**
 * Tests for Prisma AIRS Guard Hook
 */

import { describe, it, expect } from "vitest";
import handler from "./handler";

interface BootstrapFile {
  path: string;
  content: string;
  source?: string;
}

interface TestContext {
  bootstrapFiles?: BootstrapFile[];
  cfg?: Record<string, unknown>;
}

interface TestEvent {
  type: string;
  action: string;
  context?: TestContext;
}

describe("prisma-airs-guard hook", () => {
  it("injects security reminder on agent bootstrap", async () => {
    const event: TestEvent = {
      type: "agent",
      action: "bootstrap",
      context: {
        bootstrapFiles: [],
        cfg: { plugins: { entries: { "prisma-airs": { config: {} } } } },
      },
    };

    await handler(event);

    const files = event.context!.bootstrapFiles!;
    expect(files).toHaveLength(1);
    expect(files[0].path).toBe("SECURITY.md");
    expect(files[0].content).toContain("prisma_airs_scan");
    expect(files[0].source).toBe("prisma-airs-guard");
  });

  it("appends to existing bootstrapFiles", async () => {
    const event: TestEvent = {
      type: "agent",
      action: "bootstrap",
      context: {
        bootstrapFiles: [{ path: "EXISTING.md", content: "existing" }],
        cfg: {},
      },
    };

    await handler(event);

    const files = event.context!.bootstrapFiles!;
    expect(files).toHaveLength(2);
    expect(files[0].path).toBe("EXISTING.md");
    expect(files[1].path).toBe("SECURITY.md");
  });

  it("does not inject when reminder_enabled is false", async () => {
    const event: TestEvent = {
      type: "agent",
      action: "bootstrap",
      context: {
        bootstrapFiles: [],
        cfg: {
          plugins: {
            entries: {
              "prisma-airs": { config: { reminder_enabled: false } },
            },
          },
        },
      },
    };

    await handler(event);

    expect(event.context!.bootstrapFiles).toHaveLength(0);
  });

  it("ignores non-bootstrap events", async () => {
    const event: TestEvent = {
      type: "agent",
      action: "shutdown",
      context: { bootstrapFiles: [] },
    };

    await handler(event);

    expect(event.context!.bootstrapFiles).toHaveLength(0);
  });

  it("ignores non-agent events", async () => {
    const event: TestEvent = {
      type: "command",
      action: "bootstrap",
      context: { bootstrapFiles: [] },
    };

    await handler(event);

    expect(event.context!.bootstrapFiles).toHaveLength(0);
  });

  it("handles missing context gracefully", async () => {
    const event: TestEvent = {
      type: "agent",
      action: "bootstrap",
    };

    // Should not throw
    await expect(handler(event)).resolves.toBeUndefined();
  });

  it("handles missing bootstrapFiles array", async () => {
    const event: TestEvent = {
      type: "agent",
      action: "bootstrap",
      context: { cfg: {} },
    };

    // Should not throw, just skip injection
    await expect(handler(event)).resolves.toBeUndefined();
  });

  it("injects by default when no config provided", async () => {
    const event: TestEvent = {
      type: "agent",
      action: "bootstrap",
      context: { bootstrapFiles: [] },
    };

    await handler(event);

    expect(event.context!.bootstrapFiles).toHaveLength(1);
  });
});
