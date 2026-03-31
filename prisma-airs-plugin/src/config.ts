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

// ── Backward-compat re-exports (removed in T8/T10) ─────────────────

/** @deprecated Use PrismaAirsConfig booleans instead */
export type FeatureMode = "deterministic" | "probabilistic" | "off";
/** @deprecated Use PrismaAirsConfig booleans instead */
export type ReminderMode = "on" | "off";

/** @deprecated Use resolveConfig() return type instead */
export interface ResolvedModes {
  reminder: ReminderMode;
  audit: FeatureMode;
  context: FeatureMode;
  outbound: FeatureMode;
  toolGating: FeatureMode;
}

/** @deprecated Use PrismaAirsConfig instead */
export interface RawPluginConfig {
  reminder_mode?: string;
  audit_mode?: string;
  context_injection_mode?: string;
  outbound_mode?: string;
  tool_gating_mode?: string;
  fail_closed?: boolean;
  [key: string]: unknown;
}

const VALID_FEATURE_MODES: FeatureMode[] = ["deterministic", "probabilistic", "off"];
const VALID_REMINDER_MODES: ReminderMode[] = ["on", "off"];

/** @deprecated Use resolveConfig() instead */
export function resolveMode(
  modeValue: string | undefined,
  defaultMode: FeatureMode = "deterministic"
): FeatureMode {
  if (modeValue !== undefined && VALID_FEATURE_MODES.includes(modeValue as FeatureMode)) {
    return modeValue as FeatureMode;
  }
  return defaultMode;
}

/** @deprecated Use resolveConfig() instead */
export function resolveReminderMode(
  modeValue: string | undefined,
  defaultMode: ReminderMode = "on"
): ReminderMode {
  if (modeValue !== undefined && VALID_REMINDER_MODES.includes(modeValue as ReminderMode)) {
    return modeValue as ReminderMode;
  }
  return defaultMode;
}

/** @deprecated Use resolveConfig() instead */
export function resolveAllModes(config: RawPluginConfig): ResolvedModes {
  const modes: ResolvedModes = {
    reminder: resolveReminderMode(config.reminder_mode),
    audit: resolveMode(config.audit_mode),
    context: resolveMode(config.context_injection_mode),
    outbound: resolveMode(config.outbound_mode),
    toolGating: resolveMode(config.tool_gating_mode),
  };
  const failClosed = config.fail_closed ?? true;
  if (failClosed) {
    const probabilistic: string[] = [];
    if (modes.audit === "probabilistic") probabilistic.push("audit_mode");
    if (modes.context === "probabilistic") probabilistic.push("context_injection_mode");
    if (modes.outbound === "probabilistic") probabilistic.push("outbound_mode");
    if (modes.toolGating === "probabilistic") probabilistic.push("tool_gating_mode");
    if (probabilistic.length > 0) {
      throw new Error(
        `fail_closed=true is incompatible with probabilistic mode. ` +
          `Set fail_closed=false or change these to deterministic/off: ${probabilistic.join(", ")}`
      );
    }
  }
  return modes;
}
