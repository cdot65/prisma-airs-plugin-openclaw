# prisma-airs-tool-guard

Active AIRS scanning of tool call inputs via the `toolEvent` content type.

## Overview

| Field | Value |
|-------|-------|
| Event | `before_tool_call` |
| Config field | `tool_guard_mode` |
| Can Block | Yes (`{ block: true, blockReason }`) |
| Default mode | `deterministic` |
| Valid modes | `deterministic`, `probabilistic`, `off` |

## Purpose

Scans tool inputs through AIRS in real time before execution. Unlike `prisma-airs-tools` (which uses cached inbound scan results), this hook sends the actual tool call parameters to AIRS using the `toolEvent` content type for targeted analysis.

## How It Works

1. Reads `tool_guard_mode` from config (default: `deterministic`). Returns void if `off`.
2. Validates `event.toolName` exists.
3. Serializes `event.params` to JSON string (if present).
4. Calls `scan()` with a `toolEvents` array containing a single tool event:
   ```json
   {
     "metadata": {
       "ecosystem": "mcp",
       "method": "tool_call",
       "serverName": "<event.serverName or 'unknown'>",
       "toolInvoked": "<event.toolName>"
     },
     "input": "<JSON.stringify(event.params)>"
   }
   ```
5. If AIRS returns `action: "allow"`, returns void (tool proceeds).
6. Otherwise, returns `{ block: true, blockReason: "Tool '<name>' blocked by security scan: <categories>. Scan ID: <id>" }`.

### Error Handling

On scan failure:

- If `fail_closed=true` (default): Returns `{ block: true, blockReason: "Tool '<name>' blocked: security scan failed. Try again later." }`.
- If `fail_closed=false`: Returns void (tool proceeds).

## Configuration

```yaml
plugins:
  entries:
    prisma-airs:
      config:
        tool_guard_mode: "deterministic"  # "deterministic" | "probabilistic" | "off"
        profile_name: "default"
        app_name: "openclaw"
        fail_closed: true
```

## Behavior

| Condition | Result |
|-----------|--------|
| `tool_guard_mode` = `off` | No-op |
| No `toolName` in event | No-op |
| AIRS action = `allow` | Allow tool execution |
| AIRS action = `block` or `warn` | `{ block: true, blockReason }` |
| Scan fails + `fail_closed=true` | `{ block: true, blockReason }` |
| Scan fails + `fail_closed=false` | Allow tool execution |

## Related Hooks

- [prisma-airs-tools](prisma-airs-tools.md) -- Complementary cache-based tool gating (no API call). Both hooks fire on `before_tool_call`.
- [prisma-airs-tool-audit](prisma-airs-tool-audit.md) -- Scans tool outputs after execution (post-hoc audit).
