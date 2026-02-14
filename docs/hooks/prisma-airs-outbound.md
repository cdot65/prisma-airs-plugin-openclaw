# prisma-airs-outbound

Outbound response scanning with blocking and DLP masking.

## Overview

| Property      | Value                                                       |
| ------------- | ----------------------------------------------------------- |
| **Event**     | `message_sending`                                           |
| **Emoji**     | :shield:                                                    |
| **Can Block** | Yes                                                         |
| **Config**    | `outbound_scanning_enabled`, `fail_closed`, `dlp_mask_only` |

## Purpose

This hook:

1. Scans ALL outbound responses using Prisma AIRS
2. Blocks responses containing malicious content
3. Masks sensitive data (DLP) instead of blocking (configurable)

## Configuration

```yaml
plugins:
  prisma-airs:
    outbound_scanning_enabled: true # default
    fail_closed: true # Block on scan failure (default)
    dlp_mask_only: true # Mask DLP instead of block (default)
```

## Detection Capabilities

| Detection          | Description               | Action        |
| ------------------ | ------------------------- | ------------- |
| **WildFire**       | Malicious URL/content     | Block         |
| **Toxicity**       | Harmful, abusive content  | Block         |
| **URL Filtering**  | Disallowed URL categories | Block         |
| **DLP**            | PII, credentials leakage  | Mask or Block |
| **Malicious Code** | Malware, exploits         | Block         |
| **Custom Topics**  | Policy violations         | Block         |
| **Grounding**      | Hallucinations            | Block         |

## Actions

### Block

Replace the entire response with an error message:

```
Before: "Here's the malware code you requested: ..."
After:  "I apologize, but I'm unable to provide that response
        due to security policy (malicious code detected)."
```

### Mask (DLP Only)

When `dlp_mask_only: true` and only DLP violations detected:

```
Before: "Your SSN is 123-45-6789 and card is 4111-1111-1111-1111"
After:  "Your SSN is [SSN REDACTED] and card is [CARD REDACTED]"
```

### Allow

No modification.

## Masking Patterns

| Pattern     | Example                | Masked As            |
| ----------- | ---------------------- | -------------------- |
| SSN         | `123-45-6789`          | `[SSN REDACTED]`     |
| Credit Card | `4111-1111-1111-1111`  | `[CARD REDACTED]`    |
| Email       | `user@example.com`     | `[EMAIL REDACTED]`   |
| API Key     | `sk-abc123...`         | `[API KEY REDACTED]` |
| AWS Key     | `AKIAIOSFODNN7EXAMPLE` | `[AWS KEY REDACTED]` |
| Phone       | `(555) 123-4567`       | `[PHONE REDACTED]`   |
| Private IP  | `192.168.1.1`          | `[IP REDACTED]`      |

## Handler Logic

```typescript
const handler = async (event, ctx) => {
  const config = getPluginConfig(ctx);
  if (!config.enabled) return;

  const content = event.content;
  if (!content) return;

  let result;
  try {
    result = await scan({ response: content, ... });
  } catch (err) {
    if (config.failClosed) {
      return {
        content: "Unable to provide response due to security verification issue."
      };
    }
    return; // Fail-open
  }

  // Allow
  if (result.action === "allow") return;

  // Warn - log but allow
  if (result.action === "warn") {
    console.log(JSON.stringify({ event: "prisma_airs_outbound_warn", ... }));
    return;
  }

  // Block
  if (result.action === "block") {
    // Check if DLP-only (can mask instead of block)
    if (shouldMaskOnly(result, config)) {
      const masked = maskSensitiveData(content);
      if (masked !== content) {
        return { content: masked };
      }
    }

    // Full block
    return {
      content: buildBlockMessage(result)
    };
  }
};
```

## Return Value

```typescript
interface HookResult {
  content?: string; // Modified or blocked content
  cancel?: boolean; // Cancel sending entirely
}
```

## Audit Logging

### Scan Result

```json
{
  "event": "prisma_airs_outbound_scan",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "sessionKey": "session_abc123",
  "action": "block",
  "severity": "HIGH",
  "categories": ["dlp_response"],
  "scanId": "scan_xyz789",
  "latencyMs": 120,
  "responseDetected": {
    "dlp": true,
    "urlCats": false,
    "dbSecurity": false,
    "toxicContent": false,
    "maliciousCode": false,
    "agent": false,
    "ungrounded": false,
    "topicViolation": false
  }
}
```

### Mask Event

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

```json
{
  "event": "prisma_airs_outbound_block",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "sessionKey": "session_abc123",
  "action": "block",
  "severity": "CRITICAL",
  "categories": ["malicious_code_response"],
  "scanId": "scan_xyz789",
  "reportId": "report_abc123"
}
```

## Always-Block Categories

These categories always block, even with `dlp_mask_only: true`:

- `malicious_code`, `malicious_code_prompt`, `malicious_code_response`
- `malicious_url`
- `toxicity`, `toxic_content`, `toxic_content_prompt`, `toxic_content_response`
- `agent_threat`, `agent_threat_prompt`, `agent_threat_response`
- `prompt_injection`
- `db_security`, `db_security_response`
- `scan-failure`

## Related Hooks

- [prisma-airs-audit](prisma-airs-audit.md) - Inbound scanning
- [prisma-airs-tools](prisma-airs-tools.md) - Tool blocking

## Guides

- [DLP Masking Guide](../guides/dlp-masking.md) - Configure masking behavior
