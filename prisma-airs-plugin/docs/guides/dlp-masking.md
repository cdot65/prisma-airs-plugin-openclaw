# DLP Masking Guide

How to configure and use Data Loss Prevention (DLP) masking for outbound responses.

## Overview

Instead of completely blocking responses that contain sensitive data, the plugin can mask (redact) the sensitive portions while preserving the rest of the response.

## Enable Masking

```yaml
plugins:
  prisma-airs:
    dlp_mask_only: true # default
```

When `dlp_mask_only: true`:

- DLP violations in responses are masked, not blocked
- Other violations (malicious code, toxicity) still block

When `dlp_mask_only: false`:

- All violations result in blocked responses

## Masking Behavior

### Before Masking

```
Your account details:
- SSN: 123-45-6789
- Card: 4111-1111-1111-1111
- Email: user@example.com
- API Key: sk-abc123def456ghi789jkl
```

### After Masking

```
Your account details:
- SSN: [SSN REDACTED]
- Card: [CARD REDACTED]
- Email: [EMAIL REDACTED]
- API Key: [API KEY REDACTED]
```

## Masked Patterns

| Data Type              | Pattern                     | Masked As            |
| ---------------------- | --------------------------- | -------------------- |
| Social Security Number | `XXX-XX-XXXX`               | `[SSN REDACTED]`     |
| Credit Card            | `XXXX-XXXX-XXXX-XXXX`       | `[CARD REDACTED]`    |
| Email                  | `*@*.*`                     | `[EMAIL REDACTED]`   |
| API Key                | `sk-*`, `pk-*`, `api_key_*` | `[API KEY REDACTED]` |
| AWS Key                | `AKIA*`, `ABIA*`, `ASIA*`   | `[AWS KEY REDACTED]` |
| Phone Number           | `(XXX) XXX-XXXX`            | `[PHONE REDACTED]`   |
| Private IP             | `192.168.*.*`, `10.*.*.*`   | `[IP REDACTED]`      |
| Long Secrets           | 40+ char mixed alphanumeric | `[SECRET REDACTED]`  |

## Pattern Details

### Social Security Numbers

```regex
\b\d{3}-\d{2}-\d{4}\b
```

Matches: `123-45-6789`

### Credit Cards

```regex
\b(?:\d{4}[-\s]?){3}\d{4}\b
```

Matches:

- `4111-1111-1111-1111`
- `4111 1111 1111 1111`
- `4111111111111111`

### Email Addresses

```regex
\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b
```

Matches: `user@example.com`

### API Keys and Tokens

```regex
\b(?:sk-|pk-|api[_-]?key[_-]?|token[_-]?|secret[_-]?|password[_-]?)[a-zA-Z0-9_-]{16,}\b
```

Matches:

- `sk-abc123def456ghi789jkl`
- `api_key_xyz123abc456`
- `secret-myverylongsecretvalue`

### AWS Keys

```regex
\b(?:AKIA|ABIA|ACCA|ASIA)[A-Z0-9]{16}\b
```

Matches: `AKIAIOSFODNN7EXAMPLE`

### Phone Numbers

```regex
\b(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b
```

Matches:

- `(555) 123-4567`
- `555-123-4567`
- `+1 555 123 4567`

### Private IP Addresses

```regex
\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b
```

Matches:

- `192.168.1.1`
- `10.0.0.1`
- `172.16.0.1`

### Long Secrets

```regex
\b[a-zA-Z0-9_-]{40,}\b
```

Only matches if string has mixed case AND numbers.

## Always-Block Categories

These categories always block, regardless of `dlp_mask_only`:

- `malicious_code`
- `malicious_url`
- `toxicity`
- `toxic_content`
- `agent_threat`
- `prompt_injection`
- `db_security`
- `scan-failure`

## Logging

### Mask Event

When masking occurs:

```json
{
  "event": "prisma_airs_outbound_mask",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "sessionKey": "session_abc123",
  "categories": ["dlp_response"],
  "scanId": "scan_xyz789"
}
```

### Block Event

When blocking occurs (DLP + other violations):

```json
{
  "event": "prisma_airs_outbound_block",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "sessionKey": "session_abc123",
  "categories": ["dlp_response", "malicious_code"],
  "scanId": "scan_xyz789"
}
```

## Limitations

### Regex-Based Masking

Current masking uses regex patterns, which may:

- Miss unusual formats
- Have false positives
- Not catch all sensitive data

!!! tip "Future Enhancement"
Future versions will use AIRS API match offsets for precision masking when available.

### Content After Masking

If regex masking doesn't change the content (false positive from AIRS or unusual format), the response will be blocked instead of sent with potentially sensitive data.

## Configuration Examples

### Maximum Privacy (Mask Everything)

```yaml
plugins:
  prisma-airs:
    dlp_mask_only: true
    outbound_scanning_enabled: true
```

### Maximum Security (Block DLP)

```yaml
plugins:
  prisma-airs:
    dlp_mask_only: false
    outbound_scanning_enabled: true
```

### Disable DLP Scanning

```yaml
plugins:
  prisma-airs:
    outbound_scanning_enabled: false
```

Configure DLP detection in Strata Cloud Manager to reduce false positives.
