---
name: prisma-airs-outbound
description: "Scan and block/mask outbound responses using Prisma AIRS (DLP, toxicity, URLs, malicious code)"
metadata: { "openclaw": { "emoji": "🛡️", "events": ["message_sending"] } }
---

# Prisma AIRS Outbound Security

Scans all outbound responses using the full Prisma AIRS detection suite. **Can block or modify responses.**

## Detection Capabilities

| Detection          | Description                               | Action        |
| ------------------ | ----------------------------------------- | ------------- |
| **WildFire**       | Malicious URL/content detection           | Block         |
| **Toxicity**       | Harmful, abusive, inappropriate content   | Block         |
| **URL Filtering**  | Advanced URL categorization               | Block         |
| **DLP**            | Sensitive data leakage (PII, credentials) | Mask or Block |
| **Malicious Code** | Malware, exploits, dangerous code         | Block         |
| **Custom Topics**  | Organization-specific policies            | Block         |
| **Grounding**      | Hallucination/off-topic detection         | Block         |

## DLP Masking

When DLP violations are detected (and no other blocking violations), the hook will:

1. Attempt to mask sensitive data using AIRS match offsets (if available)
2. Fall back to regex-based pattern masking for common PII types
3. Return sanitized content with `[REDACTED]` markers

Masked patterns include:

- Social Security Numbers: `[SSN REDACTED]`
- Credit Card Numbers: `[CARD REDACTED]`
- Email Addresses: `[EMAIL REDACTED]`
- API Keys/Tokens: `[API KEY REDACTED]`
- Phone Numbers: `[PHONE REDACTED]`

## Configuration

- `outbound_scanning_enabled`: Enable/disable (default: true)
- `fail_closed`: Block on scan failure (default: true)
- `dlp_mask_only`: Mask DLP instead of blocking (default: true)
