# prisma-airs-audit

Fire-and-forget audit logging of inbound messages with scan cache population.

## Overview

| Field | Value |
|-------|-------|
| Event | `message_received` |
| Config field | `audit_mode` |
| Can Block | No |
| Default mode | `deterministic` |
| Valid modes | `deterministic`, `probabilistic`, `off` |

## Purpose

Scans every inbound user message through AIRS and logs the result. Caches the scan result (keyed by session + message hash) so downstream hooks (`prisma-airs-context`, `prisma-airs-tools`, `prisma-airs-tool-redact`) can reuse it without redundant API calls.

## How It Works

1. Reads `audit_mode` from config (default: `deterministic`). Returns void if `off`.
2. Validates `event.content` is a non-empty string.
3. Builds session key: `ctx.conversationId` or fallback `{event.from}_{ctx.channelId}`.
4. Calls `scan({ prompt: content, profileName, appName, appUser })` where `appUser` is `event.metadata.senderId` or `event.from`.
5. Hashes the message content and caches the result via `cacheScanResult(sessionKey, result, msgHash)`.
6. Logs a structured JSON audit entry to stdout with: action, severity, categories, scanId, reportId, latencyMs, promptDetected.

### Error Handling

On scan failure:

- Logs error to stderr.
- If `fail_closed` is `true` (default), caches a synthetic block result with `action: "block"`, `severity: "CRITICAL"`, `categories: ["scan-failure"]`, `hasError: true`.
- If `fail_closed` is `false`, does nothing (no cache entry).

## Configuration

```yaml
plugins:
  entries:
    prisma-airs:
      config:
        audit_mode: "deterministic"   # "deterministic" | "probabilistic" | "off"
        profile_name: "default"
        app_name: "openclaw"
        fail_closed: true
```

## Behavior

| Condition | Result |
|-----------|--------|
| `audit_mode` = `off` | No-op |
| Empty or non-string content | No-op |
| AIRS returns result | Cache result, log audit entry |
| AIRS scan fails + `fail_closed=true` | Cache synthetic block result |
| AIRS scan fails + `fail_closed=false` | Log error only |

## Related Hooks

- [prisma-airs-context](prisma-airs-context.md) -- Reads cached scan result; falls back to fresh scan on cache miss.
- [prisma-airs-tools](prisma-airs-tools.md) -- Reads cached scan result for tool gating decisions.
- [prisma-airs-tool-redact](prisma-airs-tool-redact.md) -- Reads cached scan result for DLP signal detection.
