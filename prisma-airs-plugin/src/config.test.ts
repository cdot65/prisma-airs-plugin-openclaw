/**
 * Tests for config mode resolution
 */

import { describe, it, expect } from "vitest";
import { resolveMode, resolveReminderMode, resolveAllModes } from "./config";

describe("resolveMode", () => {
  it("returns default when both undefined", () => {
    expect(resolveMode(undefined, undefined)).toBe("deterministic");
  });

  it("returns custom default", () => {
    expect(resolveMode(undefined, undefined, "off")).toBe("off");
  });

  it("mode string takes precedence over boolean", () => {
    expect(resolveMode("probabilistic", true)).toBe("probabilistic");
    expect(resolveMode("off", true)).toBe("off");
    expect(resolveMode("deterministic", false)).toBe("deterministic");
  });

  it("falls back to boolean when mode undefined", () => {
    expect(resolveMode(undefined, true)).toBe("deterministic");
    expect(resolveMode(undefined, false)).toBe("off");
  });

  it("ignores invalid mode string and falls back to boolean", () => {
    expect(resolveMode("invalid", true)).toBe("deterministic");
    expect(resolveMode("invalid", false)).toBe("off");
  });

  it("ignores invalid mode string and falls back to default", () => {
    expect(resolveMode("invalid", undefined)).toBe("deterministic");
  });

  it("accepts all valid mode values", () => {
    expect(resolveMode("deterministic", undefined)).toBe("deterministic");
    expect(resolveMode("probabilistic", undefined)).toBe("probabilistic");
    expect(resolveMode("off", undefined)).toBe("off");
  });
});

describe("resolveReminderMode", () => {
  it("returns default when both undefined", () => {
    expect(resolveReminderMode(undefined, undefined)).toBe("on");
  });

  it("mode string takes precedence", () => {
    expect(resolveReminderMode("off", true)).toBe("off");
    expect(resolveReminderMode("on", false)).toBe("on");
  });

  it("falls back to boolean", () => {
    expect(resolveReminderMode(undefined, true)).toBe("on");
    expect(resolveReminderMode(undefined, false)).toBe("off");
  });

  it("ignores invalid mode string", () => {
    expect(resolveReminderMode("invalid", true)).toBe("on");
    expect(resolveReminderMode("invalid", undefined)).toBe("on");
  });
});

describe("resolveAllModes", () => {
  it("returns all defaults for empty config", () => {
    const modes = resolveAllModes({ fail_closed: false });
    expect(modes).toEqual({
      reminder: "on",
      audit: "deterministic",
      context: "deterministic",
      outbound: "deterministic",
      toolGating: "deterministic",
    });
  });

  it("resolves new mode fields", () => {
    const modes = resolveAllModes({
      reminder_mode: "off",
      audit_mode: "probabilistic",
      context_injection_mode: "off",
      outbound_mode: "probabilistic",
      tool_gating_mode: "off",
      fail_closed: false,
    });
    expect(modes).toEqual({
      reminder: "off",
      audit: "probabilistic",
      context: "off",
      outbound: "probabilistic",
      toolGating: "off",
    });
  });

  it("resolves deprecated booleans", () => {
    const modes = resolveAllModes({
      reminder_enabled: false,
      audit_enabled: false,
      context_injection_enabled: true,
      outbound_scanning_enabled: false,
      tool_gating_enabled: true,
      fail_closed: false,
    });
    expect(modes).toEqual({
      reminder: "off",
      audit: "off",
      context: "deterministic",
      outbound: "off",
      toolGating: "deterministic",
    });
  });

  it("new mode takes precedence over deprecated boolean", () => {
    const modes = resolveAllModes({
      audit_mode: "probabilistic",
      audit_enabled: false, // would be "off", but mode overrides
      fail_closed: false,
    });
    expect(modes.audit).toBe("probabilistic");
  });

  it("throws when fail_closed=true with probabilistic audit", () => {
    expect(() =>
      resolveAllModes({
        audit_mode: "probabilistic",
        fail_closed: true,
      })
    ).toThrow("fail_closed=true is incompatible with probabilistic mode");
  });

  it("throws when fail_closed=true with probabilistic outbound", () => {
    expect(() =>
      resolveAllModes({
        outbound_mode: "probabilistic",
        fail_closed: true,
      })
    ).toThrow("outbound_mode");
  });

  it("throws listing all probabilistic fields when fail_closed=true", () => {
    expect(() =>
      resolveAllModes({
        audit_mode: "probabilistic",
        outbound_mode: "probabilistic",
        fail_closed: true,
      })
    ).toThrow("audit_mode, outbound_mode");
  });

  it("allows deterministic + off with fail_closed=true", () => {
    expect(() =>
      resolveAllModes({
        audit_mode: "deterministic",
        context_injection_mode: "off",
        outbound_mode: "deterministic",
        tool_gating_mode: "off",
        fail_closed: true,
      })
    ).not.toThrow();
  });

  it("fail_closed defaults to true", () => {
    // No fail_closed specified → defaults true → probabilistic should throw
    expect(() => resolveAllModes({ audit_mode: "probabilistic" })).toThrow(
      "fail_closed=true is incompatible"
    );
  });
});
