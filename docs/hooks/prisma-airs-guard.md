# prisma-airs-guard

Injects a mode-aware security reminder into the agent's system prompt.

## Overview

| Field | Value |
|-------|-------|
| Event | `before_agent_start` |
| Config field | `reminder_mode` |
| Can Block | No |
| Default mode | `on` |
| Valid modes | `on`, `off` |

## Purpose

Ensures the agent is aware of active security scanning and knows how to respond to `block`, `warn`, and `allow` directives. The reminder content adapts based on which features are running in deterministic vs probabilistic mode.

## How It Works

1. Reads `reminder_mode` from plugin config (default: `on`). Returns void if `off`.
2. Resolves all feature modes via `resolveAllModes()` using the full plugin config (`audit_mode`, `context_injection_mode`, `outbound_mode`, `tool_gating_mode`).
3. Calls `buildReminder(modes)` to generate mode-appropriate text.
4. Returns `{ systemPrompt: reminderText }`.

### Reminder Variants

- **All deterministic** -- Short reminder stating scanning runs automatically. Lists block/warn/allow response rules.
- **All probabilistic** -- Detailed reminder requiring the agent to manually call scanning tools (`prisma_airs_scan_prompt`, `prisma_airs_scan_response`, `prisma_airs_check_tool_safety`). Lists content types that require scanning.
- **Mixed mode** -- Lists which features are automatic (deterministic) and which require manual tool calls (probabilistic).

### Feature-to-Tool Mapping (probabilistic)

| Feature | Tool |
|---------|------|
| `audit` or `context` = probabilistic | `prisma_airs_scan_prompt` |
| `outbound` = probabilistic | `prisma_airs_scan_response` |
| `toolGating` = probabilistic | `prisma_airs_check_tool_safety` |

### Fallback

If `resolveAllModes()` throws (e.g., `fail_closed=true` with probabilistic modes), defaults to all-deterministic modes.

## Configuration

```yaml
plugins:
  entries:
    prisma-airs:
      config:
        reminder_mode: "on"       # "on" | "off"
        audit_mode: "deterministic"
        context_injection_mode: "deterministic"
        outbound_mode: "deterministic"
        tool_gating_mode: "deterministic"
```

## Behavior

| Condition | Result |
|-----------|--------|
| `reminder_mode` = `off` | No-op |
| All features deterministic | Returns `DETERMINISTIC_REMINDER` |
| All features probabilistic | Returns `PROBABILISTIC_REMINDER` + tool list |
| Mixed modes | Returns mixed-mode reminder with both sections |
| `resolveAllModes()` throws | Falls back to deterministic reminder |

## Related Hooks

- [prisma-airs-context](prisma-airs-context.md) -- Also fires on `before_agent_start`; injects threat warnings rather than mode reminders.
