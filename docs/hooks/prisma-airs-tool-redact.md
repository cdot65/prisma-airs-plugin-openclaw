# prisma-airs-tool-redact

DLP redaction of tool outputs before session persistence.

## Overview

| Property      | Value                                                        |
| ------------- | ------------------------------------------------------------ |
| **Event**     | `tool_result_persist`                                        |
| **Emoji**     | :lock:                                                       |
| **Can Block** | No (modifies persisted message content)                      |
| **Config**    | `tool_redact_mode`                                           |

## Purpose

This hook:

1. Fires **synchronously** before tool results are written to session JSONL
2. Applies regex-based pattern matching to detect PII and credentials
3. Redacts sensitive data (SSNs, credit cards, emails, API keys, etc.)
4. Optionally checks scan cache for AIRS DLP signals from tool-guard hook
5. Prevents sensitive data from being persisted in conversation history

## Why Tool Output Redaction Matters

When tools read files or query databases, the results may contain PII, credentials, or secrets. Without redaction, this sensitive data gets persisted in the session transcript and remains accessible in conversation history. This hook acts as a last line of defense at the persistence layer.

## Configuration

```yaml
plugins:
  prisma-airs:
    config:
      tool_redact_mode: "deterministic" # default
```

## Synchronous Requirement

This hook **must** be synchronous — the `tool_result_persist` event does not support async handlers. Therefore, this hook cannot call the AIRS API directly. Instead, it:

- Uses regex patterns for common PII types (SSNs, credit cards, emails, API keys, AWS keys, phone numbers, private IPs)
- Checks the scan cache for DLP signals from the `prisma-airs-tool-guard` hook (which fires before the tool call and can scan asynchronously)

## Redacted Patterns

| Pattern            | Replacement          |
| ------------------ | -------------------- |
| SSN (XXX-XX-XXXX)  | `[SSN REDACTED]`     |
| Credit card        | `[CARD REDACTED]`    |
| Email address      | `[EMAIL REDACTED]`   |
| API key / token    | `[API KEY REDACTED]` |
| AWS access key     | `[AWS KEY REDACTED]` |
| Long mixed secrets | `[SECRET REDACTED]`  |
| US phone number    | `[PHONE REDACTED]`   |
| Private IP address | `[IP REDACTED]`      |

## Behavior

| Condition         | Result                                        |
| ----------------- | --------------------------------------------- |
| PII detected      | Content redacted, modified message returned    |
| No PII            | No modification — original message persisted   |
| Synthetic result  | Skipped (guard/repair-generated results)       |
| Mode = off        | Skipped                                        |

## Related Hooks

- [prisma-airs-tool-guard](prisma-airs-tool-guard.md) — Scans tool inputs via AIRS (provides cached DLP signals)
- [prisma-airs-tools](prisma-airs-tools.md) — Cache-based tool gating
- [prisma-airs-outbound](prisma-airs-outbound.md) — DLP masking on outbound responses
