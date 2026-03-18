# prisma-airs-inbound-block

Hard inbound blocking — prevents user messages from being persisted unless AIRS allows them.

## Overview

| Property      | Value                                                |
| ------------- | ---------------------------------------------------- |
| **Event**     | `before_message_write`                               |
| **Emoji**     | :no_entry:                                           |
| **Can Block** | Yes (`{ block: true }`)                              |
| **Config**    | `inbound_block_mode`, `fail_closed`                  |

## Purpose

This hook:

1. Fires **before** a message is written to conversation history
2. Scans user messages through Prisma AIRS
3. Blocks any message where AIRS does not return `action: "allow"`
4. Blocked messages are never persisted — they never reach the AI model

## Configuration

```yaml
plugins:
  prisma-airs:
    config:
      inbound_block_mode: "deterministic" # default
      fail_closed: true # Block on scan failure (default)
```

## Actions

| AIRS Action | Result                           |
| ----------- | -------------------------------- |
| `allow`     | Message persisted normally       |
| `warn`      | **Blocked** — message rejected   |
| `block`     | **Blocked** — message rejected   |
| (error)     | Blocked if `fail_closed: true`   |

## Role Filtering

Only **user** messages are scanned. Assistant messages are skipped (handled by the [outbound hook](prisma-airs-outbound.md)).

## Audit Logging

### Scan Result

```json
{
  "event": "prisma_airs_inbound_block_scan",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "sessionKey": "session_abc123",
  "action": "allow",
  "severity": "SAFE",
  "categories": ["safe"],
  "scanId": "scan_xyz789",
  "latencyMs": 120
}
```

### Block Event

```json
{
  "event": "prisma_airs_inbound_block_rejected",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "sessionKey": "session_abc123",
  "action": "block",
  "severity": "CRITICAL",
  "categories": ["prompt_injection"],
  "scanId": "scan_xyz789",
  "reportId": "report_abc123"
}
```

## Related Hooks

- [prisma-airs-outbound](prisma-airs-outbound.md) — Outbound (assistant) message blocking
- [prisma-airs-audit](prisma-airs-audit.md) — Inbound scanning with audit logging
- [prisma-airs-guard](prisma-airs-guard.md) — Agent bootstrap security reminder
