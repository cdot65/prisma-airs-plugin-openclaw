import { describe, it, expect } from "vitest";
import { resolveConfig } from "./config";

describe("resolveConfig", () => {
  it("returns defaults when no config provided", () => {
    const cfg = resolveConfig({});
    expect(cfg.app_name).toBe("openclaw");
    expect(cfg.fail_closed).toBe(true);
    expect(cfg.dlp_mask_only).toBe(true);
    expect(cfg.prompt_scanning).toBe(true);
    expect(cfg.response_scanning).toBe(true);
    expect(cfg.tool_protection).toBe(true);
  });

  it("does not include removed keys", () => {
    const cfg = resolveConfig({
      security_context: true,
      llm_audit: true,
      inbound_scanning: true,
      outbound_scanning: true,
    });
    expect((cfg as any).security_context).toBeUndefined();
    expect((cfg as any).llm_audit).toBeUndefined();
    expect((cfg as any).inbound_scanning).toBeUndefined();
    expect((cfg as any).outbound_scanning).toBeUndefined();
  });

  it("preserves explicit values", () => {
    const cfg = resolveConfig({
      api_key: "test-key",
      profile_name: "my-profile",
      prompt_scanning: false,
      response_scanning: false,
      tool_protection: false,
    });
    expect(cfg.api_key).toBe("test-key");
    expect(cfg.profile_name).toBe("my-profile");
    expect(cfg.prompt_scanning).toBe(false);
    expect(cfg.response_scanning).toBe(false);
    expect(cfg.tool_protection).toBe(false);
  });

  it("ignores unknown fields", () => {
    const cfg = resolveConfig({ audit_mode: "deterministic" } as any);
    expect((cfg as any).audit_mode).toBeUndefined();
  });
});
