# prisma-airs-inbound-block

Hard guardrail that blocks user messages unless AIRS returns `allow`.

## Overview

| Field | Value |
|-------|-------|
| Event | `before_message_write` |
| Config field | `inbound_block_mode` |
| Can Block | Yes (`{ block: true }`) |
| Default mode | `deterministic` |
| Valid modes | `deterministic`, `probabilistic`, `off` |

## Purpose

Prevents unsafe user messages from being persisted to conversation history. Operates at the persistence layer, meaning blocked messages never enter the conversation and the agent never sees them.

## How It Works

1. Reads `inbound_block_mode` from config (default: `deterministic`). Returns void if `off`.
2. Checks `event.role` -- only scans `"user"` messages. Skips assistant messages (handled by `prisma-airs-outbound-block`).
3. Validates `event.content` is a non-empty string.
4. Calls `scan({ prompt: content, profileName, appName })`.
5. If AIRS returns `action: "allow"`, returns void (message persists).
6. Otherwise, returns `{ block: true }` -- message is rejected.

### Error Handling

On scan failure:

- If `fail_closed=true` (default): Returns `{ block: true }`.
- If `fail_closed=false`: Returns void (message persists).

## Configuration

```yaml
plugins:
  entries:
    prisma-airs:
      config:
        inbound_block_mode: "deterministic"  # "deterministic" | "probabilistic" | "off"
        profile_name: "default"
        app_name: "openclaw"
        fail_closed: true
```

## Behavior

| Condition | Result |
|-----------|--------|
| `inbound_block_mode` = `off` | No-op |
| `event.role` is not `"user"` | No-op |
| Empty or non-string content | No-op |
| AIRS action = `allow` | Pass through |
| AIRS action = `block` or `warn` | `{ block: true }` |
| Scan fails + `fail_closed=true` | `{ block: true }` |
| Scan fails + `fail_closed=false` | Pass through |

## Related Hooks

- [prisma-airs-outbound-block](prisma-airs-outbound-block.md) -- Companion hook that blocks assistant messages at the same persistence layer.
- [prisma-airs-audit](prisma-airs-audit.md) -- Also scans inbound messages but cannot block (fire-and-forget).
