# prisma-airs-tool-audit

Post-execution audit logging of tool outputs through Prisma AIRS.

## Overview

| Property      | Value                                               |
| ------------- | --------------------------------------------------- |
| **Event**     | `after_tool_call`                                   |
| **Emoji**     | :mag_right:                                         |
| **Can Block** | No (fire-and-forget)                                |
| **Config**    | `tool_audit_mode`                                   |

## Purpose

This hook:

1. Fires after tool execution completes
2. Serializes the tool result to a scannable string
3. Scans the result through AIRS using toolEvent content type
4. Logs structured JSON audit entries with tool metadata and scan results
5. Complements tool-guard (pre-execution) by auditing what tools actually returned

## Why Post-Execution Auditing Matters

The tool-guard hook scans inputs before execution, but cannot inspect what the tool returns. A tool might return sensitive data, malicious content, or policy-violating information that was not apparent from the input. This hook provides the audit trail for tool outputs.

## Configuration

```yaml
plugins:
  prisma-airs:
    config:
      tool_audit_mode: "deterministic" # default
```

## Audit Log Format

```json
{
  "event": "prisma_airs_tool_output_audit",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "sessionKey": "session-123",
  "toolName": "Read",
  "durationMs": 15,
  "action": "allow",
  "severity": "SAFE",
  "categories": ["safe"],
  "scanId": "scan_abc",
  "latencyMs": 42
}
```

## Behavior

| Condition          | Result                           |
| ------------------ | -------------------------------- |
| Result present     | Scanned through AIRS, logged     |
| No result / error  | Skipped (nothing to scan)        |
| Mode = off         | Skipped                          |
| Scan failure       | Error logged, execution unaffected |

## Related Hooks

- [prisma-airs-tool-guard](prisma-airs-tool-guard.md) — Pre-execution tool input scanning (can block)
- [prisma-airs-tools](prisma-airs-tools.md) — Cache-based tool gating (can block)
- [prisma-airs-tool-redact](prisma-airs-tool-redact.md) — DLP redaction before persistence
