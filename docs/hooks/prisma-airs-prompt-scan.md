# prisma-airs-prompt-scan

Scans full conversation context before prompt assembly and injects security warnings.

## Overview

| Field | Value |
|-------|-------|
| Event | `before_prompt_build` |
| Config field | `prompt_scan_mode` |
| Can Block | No |
| Default mode | `deterministic` |
| Valid modes | `deterministic`, `probabilistic`, `off` |

## Purpose

Scans the entire conversation context (all messages, not just the latest) through AIRS before the prompt is assembled for the LLM. This catches multi-message injection attacks that per-message scanning may miss. Injects warnings into system context via `prependSystemContext`.

## How It Works

1. Reads `prompt_scan_mode` from config (default: `deterministic`). Returns void if `off`.
2. Assembles scannable context:
   - If `event.messages[]` exists, concatenates all messages as `[role]: content` lines.
   - Falls back to `event.prompt` if no messages array.
3. Calls `scan({ prompt: context, profileName, appName })`.
4. If AIRS returns `action: "allow"`, returns void.
5. Otherwise, builds a security warning and returns `{ prependSystemContext: warning }`.

### Warning Format

The warning is a plain-text multi-line string:

```
[SECURITY] <LEVEL>: Prisma AIRS detected threats in conversation context.
Action: <ACTION>, Severity: <SEVERITY>, Categories: <categories>
Scan ID: <id>
<directive>
```

Where:

- `<LEVEL>` is "CRITICAL SECURITY ALERT" for `block`, "SECURITY WARNING" otherwise.
- `<directive>` is "MANDATORY: Decline the request..." for `block`, "CAUTION: Proceed carefully..." otherwise.

### Error Handling

On scan failure:

- If `fail_closed=true` (default): Returns `{ prependSystemContext: "[SECURITY] Prisma AIRS security scan failed..." }`.
- If `fail_closed=false`: Returns void.

## Configuration

```yaml
plugins:
  entries:
    prisma-airs:
      config:
        prompt_scan_mode: "deterministic"  # "deterministic" | "probabilistic" | "off"
        profile_name: "default"
        app_name: "openclaw"
        fail_closed: true
```

## Behavior

| Condition | Result |
|-----------|--------|
| `prompt_scan_mode` = `off` | No-op |
| No messages or prompt content | No-op |
| AIRS action = `allow` | No-op |
| AIRS action = `block` | Inject CRITICAL warning via `prependSystemContext` |
| AIRS action = `warn` | Inject WARNING via `prependSystemContext` |
| Scan fails + `fail_closed=true` | Inject scan-failure warning |
| Scan fails + `fail_closed=false` | No-op |

## Related Hooks

- [prisma-airs-context](prisma-airs-context.md) -- Per-message context injection on `before_agent_start`. This hook scans the full conversation on `before_prompt_build`.
- [prisma-airs-guard](prisma-airs-guard.md) -- Injects mode reminders (not threat warnings) on `before_agent_start`.
