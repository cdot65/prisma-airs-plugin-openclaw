/**
 * Tests for Prisma AIRS Guard Hook
 */

import { describe, it, expect } from "vitest";
import { handler } from "./handler";

describe("prisma-airs-guard hook", () => {
  it("injects security reminder on agent bootstrap", async () => {
    const event = {
      type: "agent",
      action: "bootstrap",
      pluginConfig: {},
      context: { systemPromptAppend: "" },
    };

    await handler(event);

    const appended = event.context.systemPromptAppend as string;
    expect(appended).toContain("SECURITY REQUIREMENT");
    expect(appended).toContain("prisma_airs_scan");
    expect(appended).toContain('action="block"');
  });

  it("appends to existing systemPromptAppend", async () => {
    const event = {
      type: "agent",
      action: "bootstrap",
      pluginConfig: {},
      context: { systemPromptAppend: "existing content\n" },
    };

    await handler(event);

    const appended = event.context.systemPromptAppend as string;
    expect(appended).toContain("existing content");
    expect(appended).toContain("SECURITY REQUIREMENT");
  });

  it("does not inject when reminder_enabled is false", async () => {
    const event = {
      type: "agent",
      action: "bootstrap",
      pluginConfig: { reminder_enabled: false },
      context: { systemPromptAppend: "" },
    };

    await handler(event);

    expect(event.context.systemPromptAppend).toBe("");
  });

  it("ignores non-bootstrap events", async () => {
    const event = {
      type: "agent",
      action: "shutdown",
      pluginConfig: {},
      context: { systemPromptAppend: "" },
    };

    await handler(event);

    expect(event.context.systemPromptAppend).toBe("");
  });

  it("ignores non-agent events", async () => {
    const event = {
      type: "command",
      action: "bootstrap",
      pluginConfig: {},
      context: { systemPromptAppend: "" },
    };

    await handler(event);

    expect(event.context.systemPromptAppend).toBe("");
  });

  it("handles missing context gracefully", async () => {
    const event = {
      type: "agent",
      action: "bootstrap",
      pluginConfig: {},
    };

    // Should not throw
    await expect(handler(event)).resolves.toBeUndefined();
  });

  it("handles undefined pluginConfig", async () => {
    const event = {
      type: "agent",
      action: "bootstrap",
      context: { systemPromptAppend: "" },
    };

    await handler(event);

    // Should inject (default is enabled)
    const appended = event.context.systemPromptAppend as string;
    expect(appended).toContain("SECURITY REQUIREMENT");
  });
});
