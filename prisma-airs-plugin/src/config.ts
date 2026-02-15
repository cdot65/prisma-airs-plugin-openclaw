/**
 * Configuration mode resolution for Prisma AIRS plugin.
 *
 * Maps new tri-state mode enums + deprecated boolean flags to resolved modes.
 */

export type FeatureMode = "deterministic" | "probabilistic" | "off";
export type ReminderMode = "on" | "off";

export interface ResolvedModes {
  reminder: ReminderMode;
  audit: FeatureMode;
  context: FeatureMode;
  outbound: FeatureMode;
  toolGating: FeatureMode;
}

/** Raw plugin config (from openclaw.plugin.json) */
export interface RawPluginConfig {
  // New mode fields
  reminder_mode?: string;
  audit_mode?: string;
  context_injection_mode?: string;
  outbound_mode?: string;
  tool_gating_mode?: string;
  // Deprecated boolean fields
  reminder_enabled?: boolean;
  audit_enabled?: boolean;
  context_injection_enabled?: boolean;
  outbound_scanning_enabled?: boolean;
  tool_gating_enabled?: boolean;
  // Other config
  fail_closed?: boolean;
  [key: string]: unknown;
}

const VALID_FEATURE_MODES: FeatureMode[] = ["deterministic", "probabilistic", "off"];
const VALID_REMINDER_MODES: ReminderMode[] = ["on", "off"];

/**
 * Resolve a single feature mode from new mode string + deprecated boolean.
 * New mode field takes precedence when both are set.
 */
export function resolveMode(
  modeValue: string | undefined,
  enabledValue: boolean | undefined,
  defaultMode: FeatureMode = "deterministic"
): FeatureMode {
  // New mode field takes precedence
  if (modeValue !== undefined) {
    if (VALID_FEATURE_MODES.includes(modeValue as FeatureMode)) {
      return modeValue as FeatureMode;
    }
    // Invalid value → fall through to boolean/default
  }

  // Deprecated boolean fallback
  if (enabledValue !== undefined) {
    return enabledValue ? "deterministic" : "off";
  }

  return defaultMode;
}

/**
 * Resolve reminder mode from new mode string + deprecated boolean.
 */
export function resolveReminderMode(
  modeValue: string | undefined,
  enabledValue: boolean | undefined,
  defaultMode: ReminderMode = "on"
): ReminderMode {
  if (modeValue !== undefined) {
    if (VALID_REMINDER_MODES.includes(modeValue as ReminderMode)) {
      return modeValue as ReminderMode;
    }
  }

  if (enabledValue !== undefined) {
    return enabledValue ? "on" : "off";
  }

  return defaultMode;
}

/**
 * Resolve all modes from raw plugin config.
 * Throws if fail_closed=true with any probabilistic mode.
 */
export function resolveAllModes(config: RawPluginConfig): ResolvedModes {
  const modes: ResolvedModes = {
    reminder: resolveReminderMode(config.reminder_mode, config.reminder_enabled),
    audit: resolveMode(config.audit_mode, config.audit_enabled),
    context: resolveMode(config.context_injection_mode, config.context_injection_enabled),
    outbound: resolveMode(config.outbound_mode, config.outbound_scanning_enabled),
    toolGating: resolveMode(config.tool_gating_mode, config.tool_gating_enabled),
  };

  // Validate: fail_closed + probabilistic is not allowed
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
