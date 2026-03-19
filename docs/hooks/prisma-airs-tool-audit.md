# prisma-airs-tool-audit

Fire-and-forget audit logging of tool execution results through AIRS.

## Overview

| Field | Value |
|-------|-------|
| Event | `after_tool_call` |
| Config field | `tool_audit_mode` |
| Can Block | No |
| Default mode | `deterministic` |
| Valid modes | `deterministic`, `probabilistic`, `off` |

## Purpose

Scans tool execution results through AIRS after a tool call completes. Provides a post-execution audit trail that complements the pre-execution scanning done by `prisma-airs-tool-guard`. Detects threats in tool outputs that may not have been present in the inputs.

## How It Works

1. Reads `tool_audit_mode` from config (default: `deterministic`). Returns void if `off`.
2. Serializes `event.result` to a string:
   - If `null`/`undefined`: skips.
   - If string: uses directly.
   - Otherwise: `JSON.stringify()`, falling back to `String()`.
3. Skips if serialized result is empty after trimming.
4. Calls `scan()` with both `response` and `toolEvents`:
   ```json
   {
     "response": "<resultStr>",
     "profileName": "...",
     "appName": "...",
     "toolEvents": [{
       "metadata": {
         "ecosystem": "mcp",
         "method": "tool_result",
         "serverName": "local",
         "toolInvoked": "<event.toolName>"
       },
       "input": "<resultStr>"
     }]
   }
   ```
5. Logs structured JSON to stdout with: toolName, durationMs, action, severity, categories, scanId, reportId, latencyMs, responseDetected.

### Error Handling

On scan failure:

- Logs error to stderr.
- Returns void (fire-and-forget, no blocking).
- No fail-closed behavior.

## Configuration

```yaml
plugins:
  entries:
    prisma-airs:
      config:
        tool_audit_mode: "deterministic"  # "deterministic" | "probabilistic" | "off"
        profile_name: "default"
        app_name: "openclaw"
```

## Behavior

| Condition | Result |
|-----------|--------|
| `tool_audit_mode` = `off` | No-op |
| `event.result` is null/undefined | No-op |
| Serialized result is empty | No-op |
| Scan succeeds | Log audit entry |
| Scan fails | Log error, no-op |

## Related Hooks

- [prisma-airs-tool-guard](prisma-airs-tool-guard.md) -- Pre-execution tool input scanning. This hook provides post-execution output audit.
- [prisma-airs-llm-audit](prisma-airs-llm-audit.md) -- Companion audit hook for LLM I/O.
- [prisma-airs-tool-redact](prisma-airs-tool-redact.md) -- Redacts tool output at persistence time (synchronous). This hook scans asynchronously after the fact.
