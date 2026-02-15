/**
 * Tests for Prisma AIRS Guard Hook
 */

import { describe, it, expect } from "vitest";
import handler, { buildReminder, DETERMINISTIC_REMINDER, PROBABILISTIC_REMINDER } from "./handler";

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
    expect(files[0].content).toContain("MANDATORY Security Scanning");
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

  it("does not inject when reminder_mode is off", async () => {
    const event: TestEvent = {
      type: "agent",
      action: "bootstrap",
      context: {
        bootstrapFiles: [],
        cfg: {
          plugins: {
            entries: {
              "prisma-airs": { config: { reminder_mode: "off" } },
            },
          },
        },
      },
    };

    await handler(event);
    expect(event.context!.bootstrapFiles).toHaveLength(0);
  });

  it("injects when reminder_mode is on", async () => {
    const event: TestEvent = {
      type: "agent",
      action: "bootstrap",
      context: {
        bootstrapFiles: [],
        cfg: {
          plugins: {
            entries: {
              "prisma-airs": {
                config: { reminder_mode: "on" },
              },
            },
          },
        },
      },
    };

    await handler(event);
    expect(event.context!.bootstrapFiles).toHaveLength(1);
  });
});

describe("buildReminder", () => {
  it("returns deterministic reminder when all deterministic", () => {
    const text = buildReminder({
      reminder: "on",
      audit: "deterministic",
      context: "deterministic",
      outbound: "deterministic",
      toolGating: "deterministic",
    });
    expect(text).toBe(DETERMINISTIC_REMINDER);
  });

  it("returns probabilistic reminder with tools when all probabilistic", () => {
    const text = buildReminder({
      reminder: "on",
      audit: "probabilistic",
      context: "probabilistic",
      outbound: "probabilistic",
      toolGating: "probabilistic",
    });
    expect(text).toContain(PROBABILISTIC_REMINDER);
    expect(text).toContain("prisma_airs_scan_prompt");
    expect(text).toContain("prisma_airs_scan_response");
    expect(text).toContain("prisma_airs_check_tool_safety");
  });

  it("returns mixed reminder for mixed modes", () => {
    const text = buildReminder({
      reminder: "on",
      audit: "deterministic",
      context: "deterministic",
      outbound: "probabilistic",
      toolGating: "off",
    });
    expect(text).toContain("Mixed Mode");
    expect(text).toContain("Audit logging");
    expect(text).toContain("Context injection");
    expect(text).toContain("Outbound scanning");
    expect(text).toContain("prisma_airs_scan_response");
    expect(text).not.toContain("prisma_airs_check_tool_safety");
  });

  it("treats off features as neither deterministic nor probabilistic", () => {
    const text = buildReminder({
      reminder: "on",
      audit: "off",
      context: "off",
      outbound: "off",
      toolGating: "off",
    });
    // All off → no probabilistic → deterministic reminder (empty deterministic list but still deterministic path)
    expect(text).toBe(DETERMINISTIC_REMINDER);
  });
});
