/**
 * Tests for Prisma AIRS Guard Hook
 */

import { describe, it, expect } from "vitest";
import handler, { buildReminder, DETERMINISTIC_REMINDER, PROBABILISTIC_REMINDER } from "./handler";

function makeCtx(config?: Record<string, unknown>) {
  return {
    cfg: {
      plugins: {
        entries: {
          "prisma-airs": { config: config ?? {} },
        },
      },
    },
  };
}

describe("prisma-airs-guard hook", () => {
  it("returns systemPrompt with deterministic reminder by default", async () => {
    const result = await handler({}, makeCtx());
    expect(result).toBeDefined();
    expect(result!.systemPrompt).toContain("Security Scanning Active");
  });

  it("returns deterministic reminder when all modes are deterministic", async () => {
    const result = await handler(
      {},
      makeCtx({
        audit_mode: "deterministic",
        context_injection_mode: "deterministic",
        outbound_mode: "deterministic",
        tool_gating_mode: "deterministic",
      })
    );
    expect(result!.systemPrompt).toBe(DETERMINISTIC_REMINDER);
  });

  it("returns undefined when reminder_mode is off", async () => {
    const result = await handler({}, makeCtx({ reminder_mode: "off" }));
    expect(result).toBeUndefined();
  });

  it("returns systemPrompt when reminder_mode is on", async () => {
    const result = await handler({}, makeCtx({ reminder_mode: "on" }));
    expect(result).toBeDefined();
    expect(result!.systemPrompt).toBeDefined();
  });

  it("handles missing config gracefully", async () => {
    const result = await handler({}, {});
    // Default reminder_mode is "on", should still return a reminder
    expect(result).toBeDefined();
    expect(result!.systemPrompt).toContain("Security Scanning");
  });

  it("builds mode-aware reminder for probabilistic modes", async () => {
    const result = await handler(
      {},
      makeCtx({
        audit_mode: "probabilistic",
        context_injection_mode: "probabilistic",
        outbound_mode: "probabilistic",
        tool_gating_mode: "probabilistic",
        fail_closed: false,
      })
    );
    expect(result!.systemPrompt).toContain("MANDATORY Security Scanning");
    expect(result!.systemPrompt).toContain("prisma_airs_scan_prompt");
  });

  it("builds mixed mode reminder", async () => {
    const result = await handler(
      {},
      makeCtx({
        audit_mode: "deterministic",
        context_injection_mode: "deterministic",
        outbound_mode: "probabilistic",
        tool_gating_mode: "off",
        fail_closed: false,
      })
    );
    expect(result!.systemPrompt).toContain("Mixed Mode");
    expect(result!.systemPrompt).toContain("Audit logging");
    expect(result!.systemPrompt).toContain("prisma_airs_scan_response");
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
    // All off → no probabilistic → deterministic reminder
    expect(text).toBe(DETERMINISTIC_REMINDER);
  });
});
