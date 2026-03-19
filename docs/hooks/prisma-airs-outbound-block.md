# prisma-airs-outbound-block

Hard guardrail that blocks assistant messages unless AIRS returns `allow`.

## Overview

| Field | Value |
|-------|-------|
| Event | `before_message_write` |
| Config field | `outbound_block_mode` |
| Can Block | Yes (`{ block: true }`) |
| Default mode | `deterministic` |
| Valid modes | `deterministic`, `probabilistic`, `off` |

## Purpose

Prevents unsafe assistant responses from being persisted to conversation history. Operates at the persistence layer, meaning blocked messages are never stored and never delivered.

## How It Works

1. Reads `outbound_block_mode` from config (default: `deterministic`). Returns void if `off`.
2. Checks `event.role` -- only scans `"assistant"` messages. Skips user messages (handled by `prisma-airs-inbound-block`).
3. Validates `event.content` is a non-empty string.
4. Calls `scan({ response: content, profileName, appName })`.
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
        outbound_block_mode: "deterministic"  # "deterministic" | "probabilistic" | "off"
        profile_name: "default"
        app_name: "openclaw"
        fail_closed: true
```

## Behavior

| Condition | Result |
|-----------|--------|
| `outbound_block_mode` = `off` | No-op |
| `event.role` is not `"assistant"` | No-op |
| Empty or non-string content | No-op |
| AIRS action = `allow` | Pass through |
| AIRS action = `block` or `warn` | `{ block: true }` |
| Scan fails + `fail_closed=true` | `{ block: true }` |
| Scan fails + `fail_closed=false` | Pass through |

## Related Hooks

- [prisma-airs-inbound-block](prisma-airs-inbound-block.md) -- Companion hook that blocks user messages at the same persistence layer.
- [prisma-airs-outbound](prisma-airs-outbound.md) -- Operates at the delivery layer; can mask content instead of blocking.
