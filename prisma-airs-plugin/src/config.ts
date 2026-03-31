/**
 * Prisma AIRS plugin configuration.
 *
 * Flat boolean config — no tristate modes.
 * Each boolean maps to a hook group (on = enabled, off = disabled).
 */

export interface PrismaAirsConfig {
  api_key?: string;
  profile_name?: string;
  app_name?: string;
  fail_closed?: boolean;
  dlp_mask_only?: boolean;
  prompt_scanning?: boolean;
  response_scanning?: boolean;
  tool_protection?: boolean;
}

/**
 * Resolve config with defaults applied.
 * Only returns known fields — strips any legacy or unknown fields.
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
    prompt_scanning: typeof raw.prompt_scanning === "boolean" ? raw.prompt_scanning : true,
    response_scanning: typeof raw.response_scanning === "boolean" ? raw.response_scanning : true,
    tool_protection: typeof raw.tool_protection === "boolean" ? raw.tool_protection : true,
  };
}
