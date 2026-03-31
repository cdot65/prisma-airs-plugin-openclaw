import { describe, it, expect } from "vitest";
import { resolveConfig } from "./config";

describe("resolveConfig", () => {
  it("returns defaults when no config provided", () => {
    const cfg = resolveConfig({});
    expect(cfg.app_name).toBe("openclaw");
    expect(cfg.fail_closed).toBe(true);
    expect(cfg.dlp_mask_only).toBe(true);
    expect(cfg.inbound_scanning).toBe(true);
    expect(cfg.outbound_scanning).toBe(true);
    expect(cfg.tool_protection).toBe(true);
    expect(cfg.security_context).toBe(true);
    expect(cfg.llm_audit).toBe(false);
  });

  it("preserves explicit values", () => {
    const cfg = resolveConfig({
      api_key: "test-key",
      profile_name: "my-profile",
      inbound_scanning: false,
      llm_audit: true,
    });
    expect(cfg.api_key).toBe("test-key");
    expect(cfg.profile_name).toBe("my-profile");
    expect(cfg.inbound_scanning).toBe(false);
    expect(cfg.llm_audit).toBe(true);
  });

  it("ignores unknown fields", () => {
    const cfg = resolveConfig({ audit_mode: "deterministic" } as any);
    expect((cfg as any).audit_mode).toBeUndefined();
  });
});
