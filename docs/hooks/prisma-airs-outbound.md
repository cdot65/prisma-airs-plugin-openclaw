# prisma-airs-outbound

Scans outbound assistant responses and blocks or masks content based on AIRS results.

## Overview

| Field | Value |
|-------|-------|
| Event | `message_sending` |
| Config field | `outbound_mode` |
| Can Block | Yes (via content replacement) |
| Default mode | `deterministic` |
| Valid modes | `deterministic`, `probabilistic`, `off` |

## Purpose

Scans every outbound response through AIRS before delivery. Blocks on any non-`allow` action. When the only detection is DLP (and `dlp_mask_only` is true), applies regex-based masking instead of a full block.

## How It Works

1. Reads `outbound_mode` from config (default: `deterministic`). Returns void if `off`.
2. Validates `event.content` is a non-empty string.
3. Calls `scan({ response: content, profileName, appName })`.
4. If AIRS returns `action: "allow"`, returns void (message passes through).
5. If result qualifies for DLP masking (see below), applies `maskSensitiveData()` and returns `{ content: maskedContent }`.
6. Otherwise, returns `{ content: blockMessage }` replacing the entire response.

### DLP Mask vs Full Block

The `shouldMaskOnly()` function determines whether to mask or block:

- `dlp_mask_only` must be `true` (default).
- No "always-block" categories may be present.
- All categories must be maskable (`dlp_response`, `dlp_prompt`, `dlp`) or safe/benign.

**Always-block categories** (never maskable):

`malicious_code`, `malicious_code_prompt`, `malicious_code_response`, `malicious_url`, `toxicity`, `toxic_content`, `toxic_content_prompt`, `toxic_content_response`, `agent_threat`, `agent_threat_prompt`, `agent_threat_response`, `prompt_injection`, `db_security`, `db_security_response`, `scan-failure`

### DLP Masking Patterns

The `maskSensitiveData()` function applies these regex patterns:

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

### Block Message Format

When fully blocked, the response is replaced with:

```
I apologize, but I'm unable to provide that response due to security policy (<reasons>). Please rephrase your request or contact support if you believe this is an error.
```

Where `<reasons>` is a comma-separated list of human-readable category descriptions.

### Error Handling

On scan failure:

- If `fail_closed=true` (default): Returns a generic security verification error message as replacement content.
- If `fail_closed=false`: Returns void (message passes through).

## Configuration

```yaml
plugins:
  entries:
    prisma-airs:
      config:
        outbound_mode: "deterministic"  # "deterministic" | "probabilistic" | "off"
        profile_name: "default"
        app_name: "openclaw"
        fail_closed: true
        dlp_mask_only: true             # true = mask DLP-only results; false = always block
```

## Behavior

| Condition | Result |
|-----------|--------|
| `outbound_mode` = `off` | No-op |
| Empty or non-string content | No-op |
| AIRS action = `allow` | Pass through |
| DLP-only categories + `dlp_mask_only=true` | Regex-mask sensitive data |
| DLP-only but masking changes nothing | Full block message |
| Any always-block category | Full block message |
| Scan fails + `fail_closed=true` | Generic error replacement |
| Scan fails + `fail_closed=false` | Pass through |

## Related Hooks

- [prisma-airs-outbound-block](prisma-airs-outbound-block.md) -- Hard guardrail at persistence layer; this hook operates at delivery layer.
- [prisma-airs-tool-redact](prisma-airs-tool-redact.md) -- Uses identical DLP regex patterns for tool output redaction.
