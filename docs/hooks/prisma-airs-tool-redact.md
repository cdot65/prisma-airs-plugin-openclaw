# prisma-airs-tool-redact

Synchronous regex-based DLP redaction of tool outputs before persistence.

## Overview

| Field | Value |
|-------|-------|
| Event | `tool_result_persist` |
| Config field | `tool_redact_mode` |
| Can Block | No |
| Default mode | `deterministic` |
| Valid modes | `deterministic`, `probabilistic`, `off` |

## Purpose

Redacts sensitive data (PII, credentials) from tool outputs before they are written to session history. This is a synchronous hook -- it cannot make async API calls. It uses regex-based pattern matching identical to the outbound hook's `maskSensitiveData()`.

## How It Works

1. Reads `tool_redact_mode` from config (default: `deterministic`). Returns void if `off`.
2. Skips synthetic results (`event.isSynthetic === true`).
3. Validates `event.message.content` is a non-empty array.
4. Optionally checks scan cache for AIRS DLP signal (`cached.responseDetected.dlp === true`) for audit logging purposes.
5. Iterates over each content item in `event.message.content`:
   - Only processes items where `type === "text"` and `text` is a string.
   - Applies `maskSensitiveData()` to each text item.
6. If any content was modified, returns `{ message: { ...message, content: newContent } }`.
7. If nothing changed, returns void.

### DLP Masking Patterns

Identical to `prisma-airs-outbound`:

| Pattern | Replacement |
|---------|-------------|
| SSN (`XXX-XX-XXXX`) | `[SSN REDACTED]` |
| Credit card (4 groups of 4 digits) | `[CARD REDACTED]` |
| Email addresses | `[EMAIL REDACTED]` |
| API keys/tokens (`sk-`, `pk-`, `api_key`, `token`, `secret`, `password` + 16+ chars) | `[API KEY REDACTED]` |
| AWS keys (`AKIA`, `ABIA`, `ACCA`, `ASIA` + 16 chars) | `[AWS KEY REDACTED]` |
| Long mixed-case alphanumeric strings (40+ chars with lowercase + uppercase + digits) | `[SECRET REDACTED]` |
| US phone numbers | `[PHONE REDACTED]` |
| Private IP addresses (10.x, 172.16-31.x, 192.168.x) | `[IP REDACTED]` |

### Audit Logging

When content is modified, logs a JSON entry with:

- `action`: `"cache_dlp"` if AIRS DLP signal was cached, `"regex"` otherwise.
- `cachedDlp`: boolean indicating whether the cached scan had a DLP detection.
- `toolName`: from event or message.

## Configuration

```yaml
plugins:
  entries:
    prisma-airs:
      config:
        tool_redact_mode: "deterministic"  # "deterministic" | "probabilistic" | "off"
```

## Behavior

| Condition | Result |
|-----------|--------|
| `tool_redact_mode` = `off` | No-op |
| `event.isSynthetic` = `true` | No-op |
| No content items | No-op |
| Content items with no text type | No-op |
| Regex matches found | Return modified message with redacted text |
| No regex matches | No-op |

## Related Hooks

- [prisma-airs-outbound](prisma-airs-outbound.md) -- Uses identical DLP regex patterns for outbound response masking.
- [prisma-airs-audit](prisma-airs-audit.md) -- Populates scan cache that this hook optionally reads for DLP signals.
- [prisma-airs-tool-guard](prisma-airs-tool-guard.md) -- Pre-execution tool scanning; this hook handles post-execution output redaction.
