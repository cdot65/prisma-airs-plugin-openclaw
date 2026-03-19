# DLP Masking Guide

How Data Loss Prevention masking works across the outbound handler and tool-redact handler.

## Overview

Instead of blocking responses that contain only DLP violations, the plugin can mask (redact) sensitive data while preserving the rest of the content. Two handlers perform masking:

- **Outbound handler** (`prisma-airs-outbound`): masks outbound assistant responses via `message_sending`
- **Tool-redact handler** (`prisma-airs-tool-redact`): masks tool output content via `tool_result_persist`

Both handlers use the same set of regex patterns.

## Configuration

```json
{
  "dlp_mask_only": true,
  "outbound_mode": "deterministic",
  "tool_redact_mode": "deterministic"
}
```

| Setting | Effect |
|---------|--------|
| `dlp_mask_only: true` (default) | DLP-only violations are masked in outbound responses |
| `dlp_mask_only: false` | DLP violations block the response entirely |
| `tool_redact_mode: "deterministic"` (default) | Tool outputs are always redacted via regex |
| `tool_redact_mode: "off"` | Tool output redaction disabled |

!!! info "Tool redaction is independent"
    `tool_redact_mode` applies regex masking to ALL tool outputs regardless of `dlp_mask_only`. It does not require an AIRS scan -- it is a synchronous regex pass.

## Regex Patterns

Both handlers apply these patterns in order:

### Social Security Numbers

```
Pattern: \b\d{3}-\d{2}-\d{4}\b
Replace: [SSN REDACTED]
Example: 123-45-6789 -> [SSN REDACTED]
```

### Credit Card Numbers

```
Pattern: \b(?:\d{4}[-\s]?){3}\d{4}\b
Replace: [CARD REDACTED]
Example: 4111-1111-1111-1111 -> [CARD REDACTED]
Example: 4111111111111111    -> [CARD REDACTED]
Example: 4111 1111 1111 1111 -> [CARD REDACTED]
```

### Email Addresses

```
Pattern: \b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b
Replace: [EMAIL REDACTED]
Example: user@example.com -> [EMAIL REDACTED]
```

### API Keys and Tokens

```
Pattern: \b(?:sk-|pk-|api[_-]?key[_-]?|token[_-]?|secret[_-]?|password[_-]?)[a-zA-Z0-9_-]{16,}\b
Replace: [API KEY REDACTED]
Example: sk-abc123def456ghi789jkl -> [API KEY REDACTED]
Example: api_key_xyz123abc456def -> [API KEY REDACTED]
```

### AWS Keys

```
Pattern: \b(?:AKIA|ABIA|ACCA|ASIA)[A-Z0-9]{16}\b
Replace: [AWS KEY REDACTED]
Example: AKIAIOSFODNN7EXAMPLE -> [AWS KEY REDACTED]
```

### Generic Long Secrets

```
Pattern: \b[a-zA-Z0-9_-]{40,}\b (only if mixed case AND numbers)
Replace: [SECRET REDACTED]
```

### US Phone Numbers

```
Pattern: \b(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b
Replace: [PHONE REDACTED]
Example: (555) 123-4567   -> [PHONE REDACTED]
Example: +1 555-123-4567  -> [PHONE REDACTED]
```

### Private IP Addresses

```
Pattern: \b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b
Replace: [IP REDACTED]
Example: 192.168.1.1  -> [IP REDACTED]
Example: 10.0.0.1     -> [IP REDACTED]
Example: 172.16.0.1   -> [IP REDACTED]
```

## Before/After Example

**Before masking:**

```
Your account details:
- SSN: 123-45-6789
- Card: 4111-1111-1111-1111
- Email: user@example.com
- API Key: sk-abc123def456ghi789jkl
- Server: 192.168.1.100
- Phone: (555) 123-4567
```

**After masking:**

```
Your account details:
- SSN: [SSN REDACTED]
- Card: [CARD REDACTED]
- Email: [EMAIL REDACTED]
- API Key: [API KEY REDACTED]
- Server: [IP REDACTED]
- Phone: [PHONE REDACTED]
```

## Always-Block Categories

These categories override `dlp_mask_only` and always trigger a full block in the outbound handler. If any of these are present alongside DLP, the response is blocked rather than masked:

```typescript
const ALWAYS_BLOCK_CATEGORIES = [
  "malicious_code",       "malicious_code_prompt",  "malicious_code_response",
  "malicious_url",
  "toxicity",             "toxic_content",
  "toxic_content_prompt", "toxic_content_response",
  "agent_threat",         "agent_threat_prompt",     "agent_threat_response",
  "prompt_injection",
  "db_security",          "db_security_response",
  "scan-failure",
];
```

## Masking Decision Flow

The `shouldMaskOnly()` function in the outbound handler:

1. If `dlp_mask_only` is `false` -- never mask, always block
2. If any `ALWAYS_BLOCK_CATEGORIES` are present -- block
3. If all categories are maskable (`dlp_response`, `dlp_prompt`, `dlp`, `safe`, `benign`) -- mask
4. Otherwise -- block

After deciding to mask, if regex masking produces no changes (unusual format the patterns miss), the response is blocked as a safety fallback.

## Outbound Handler vs Tool-Redact Handler

| Aspect | Outbound (`message_sending`) | Tool-Redact (`tool_result_persist`) |
|--------|------------------------------|-------------------------------------|
| Trigger | AIRS scan returns non-allow action with DLP-only categories | Every tool result (always, when mode is `deterministic`) |
| Async | Yes | No (synchronous) |
| AIRS scan | Yes, scans response content | No, regex-only (optionally checks scan cache for DLP signal) |
| Scope | Full assistant message | Individual tool result content items of type `text` |
| Skips | Empty content | Synthetic results (`isSynthetic: true`) |
| Config | `outbound_mode` + `dlp_mask_only` | `tool_redact_mode` |

## Logging

### Outbound Mask Event

```json
{
  "event": "prisma_airs_outbound_mask",
  "sessionKey": "session_abc123",
  "action": "warn",
  "categories": ["dlp_response"],
  "scanId": "scan_xyz789"
}
```

### Tool Redact Event

```json
{
  "event": "prisma_airs_tool_redact",
  "sessionKey": "session_abc123",
  "toolName": "Read",
  "action": "regex",
  "cachedDlp": false
}
```

The `action` field is `"cache_dlp"` when the scan cache had a DLP signal, `"regex"` otherwise.

## Limitations

- Regex-based masking may miss unusual formats or produce false positives
- If AIRS flags DLP but the regex patterns do not match, the outbound handler falls back to blocking
- Public IP addresses are not masked (only RFC 1918 private ranges)

## Source Files

- Outbound masking: `prisma-airs-plugin/hooks/prisma-airs-outbound/handler.ts`
- Tool redaction: `prisma-airs-plugin/hooks/prisma-airs-tool-redact/handler.ts`
