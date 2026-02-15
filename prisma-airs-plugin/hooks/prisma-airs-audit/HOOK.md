---
name: prisma-airs-audit
description: "Audit log all inbound messages with Prisma AIRS scan results"
metadata: { "openclaw": { "emoji": "📋", "events": ["message_received"] } }
---

# Prisma AIRS Audit Logger

Fire-and-forget audit logging of all inbound messages using Prisma AIRS.

## Behavior

This hook runs asynchronously on every inbound message. It:

1. Scans the message content using Prisma AIRS
2. Caches the scan result for downstream hooks (`before_agent_start`)
3. Logs the scan result for audit compliance

## Limitations

- **Cannot block messages** - `message_received` is fire-and-forget
- Results are cached for 30 seconds for downstream hooks to use

## Audit Log Format

```json
{
  "event": "prisma_airs_inbound_scan",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "sessionKey": "session_abc123",
  "senderId": "user@example.com",
  "channel": "slack",
  "action": "block",
  "severity": "HIGH",
  "categories": ["prompt-injection"],
  "scanId": "scan_xyz789",
  "latencyMs": 145
}
```

## Configuration

Controlled by plugin config:

- `audit_mode`: Scanning mode (default: `deterministic`). Options: `deterministic` / `probabilistic` / `off`
- `profile_name`: AIRS profile to use for scanning
- `app_name`: Application name for scan metadata
