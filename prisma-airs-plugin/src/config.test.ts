/**
 * Tests for config mode resolution
 */

import { describe, it, expect } from "vitest";
import { resolveMode, resolveReminderMode, resolveAllModes } from "./config";

describe("resolveMode", () => {
  it("returns default when undefined", () => {
    expect(resolveMode(undefined)).toBe("deterministic");
  });

  it("returns custom default", () => {
    expect(resolveMode(undefined, "off")).toBe("off");
  });

  it("ignores invalid mode string and falls back to default", () => {
    expect(resolveMode("invalid")).toBe("deterministic");
  });

  it("accepts all valid mode values", () => {
    expect(resolveMode("deterministic")).toBe("deterministic");
    expect(resolveMode("probabilistic")).toBe("probabilistic");
    expect(resolveMode("off")).toBe("off");
  });
});

describe("resolveReminderMode", () => {
  it("returns default when undefined", () => {
    expect(resolveReminderMode(undefined)).toBe("on");
  });

  it("resolves valid mode values", () => {
    expect(resolveReminderMode("off")).toBe("off");
    expect(resolveReminderMode("on")).toBe("on");
  });

  it("ignores invalid mode string", () => {
    expect(resolveReminderMode("invalid")).toBe("on");
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
