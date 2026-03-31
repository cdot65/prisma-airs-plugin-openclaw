/**
 * Prisma AIRS plugin configuration.
 *
 * Flat boolean config — no tristate modes.
 * Each boolean maps to a hook group (on = deterministic, off = disabled).
 */

export interface PrismaAirsConfig {
  api_key?: string;
  profile_name?: string;
  app_name?: string;
  fail_closed?: boolean;
  dlp_mask_only?: boolean;
  inbound_scanning?: boolean;
  outbound_scanning?: boolean;
  tool_protection?: boolean;
  security_context?: boolean;
  llm_audit?: boolean;
}

/**
 * Resolve config with defaults applied.
 * Only returns known fields — strips any legacy mode fields.
 */
export function resolveConfig(
  raw: Record<string, unknown>
): Required<Omit<PrismaAirsConfig, "api_key" | "profile_name">> &
  Pick<PrismaAirsConfig, "api_key" | "profile_name"> {
  return {
    api_key: typeof raw.api_key === "string" ? raw.api_key : undefined,
    profile_name: typeof raw.profile_name === "string" ? raw.profile_name : undefined,
    app_name: typeof raw.app_name === "string" ? raw.app_name : "openclaw",
    fail_closed: typeof raw.fail_closed === "boolean" ? raw.fail_closed : true,
    dlp_mask_only: typeof raw.dlp_mask_only === "boolean" ? raw.dlp_mask_only : true,
    inbound_scanning: typeof raw.inbound_scanning === "boolean" ? raw.inbound_scanning : true,
    outbound_scanning: typeof raw.outbound_scanning === "boolean" ? raw.outbound_scanning : true,
    tool_protection: typeof raw.tool_protection === "boolean" ? raw.tool_protection : true,
    security_context: typeof raw.security_context === "boolean" ? raw.security_context : true,
    llm_audit: typeof raw.llm_audit === "boolean" ? raw.llm_audit : false,
  };
}
