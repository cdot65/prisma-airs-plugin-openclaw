---
name: prisma-airs
version: 0.1.0
description: Prisma AIRS (AI Runtime Security) integration for OpenClaw using the official pan-aisecurity SDK. Scans prompts and responses through Palo Alto Networks AI security service for injection attacks, data leakage, malicious URLs, and PII detection.
---

# Prisma AIRS Skill

AI Runtime Security scanning for OpenClaw agents via Palo Alto Networks Prisma AIRS.

## What It Does

Uses the official `pan-aisecurity` SDK to scan prompts/responses:
- **Prompt Injection Detection** - Catches manipulation attempts
- **Data Leakage Prevention (DLP)** - Blocks sensitive data exposure
- **URL Filtering** - Identifies malicious URLs
- **PII Protection** - Detects personally identifiable information

## Quick Start

```python
from prisma_airs_skill import PrismaAIRS

scanner = PrismaAIRS()
result = scanner.scan("user message", context={"user_id": "123"})

if result.action.value == "block":
    return "Request blocked by security policy."
```

## Configuration

Set credentials via environment:

```bash
export PANW_AI_SEC_API_KEY="your-api-key"
```

Or in `config.yaml`:

```yaml
prisma_airs:
  api_key: "${PANW_AI_SEC_API_KEY}"
  profile_name: "default"
```

## Security Actions

| Detection | Action | Response |
|-----------|--------|----------|
| prompt_injection | block | Block request, log attempt |
| dlp_prompt | block | Block, sensitive data in input |
| dlp_response | block | Block, sensitive data in output |
| url_filtering | block | Block malicious URLs |
| safe | allow | Process normally |

## API Reference

### PrismaAIRS.scan()

```python
result = scanner.scan(
    prompt="message to scan",
    response=None,  # Optional: scan AI response too
    context={
        "user_id": "123",
        "is_group": True,
    }
)
```

**Returns:** `ScanResult` with:
- `action`: Action enum (ALLOW, WARN, BLOCK)
- `severity`: Severity enum (SAFE, LOW, MEDIUM, HIGH, CRITICAL)
- `categories`: List of detected issues
- `scan_id`: Prisma AIRS scan ID
- `report_id`: Prisma AIRS report ID
- `prompt_detected`: Dict of prompt detections
- `response_detected`: Dict of response detections

## CLI Usage

```bash
# Basic scan
uv run prisma-airs-scan "message"

# JSON output
uv run prisma-airs-scan --json "message"

# Specify profile
uv run prisma-airs-scan --profile strict "message"

# Scan with response
uv run prisma-airs-scan --prompt "user msg" --response "ai response"

# Configuration audit
uv run prisma-airs-audit
uv run prisma-airs-audit --verbose
uv run prisma-airs-audit --quick  # Skip connectivity test
```

## Integration Example

```python
from prisma_airs_skill import PrismaAIRS, Action

class SecureAgent:
    def __init__(self):
        self.scanner = PrismaAIRS()

    async def process(self, user_input: str) -> str:
        # Scan input
        result = self.scanner.scan(prompt=user_input)
        if result.action == Action.BLOCK:
            return "Request blocked for security reasons."

        # Process with LLM
        response = await self.llm.generate(user_input)

        # Scan output
        output_result = self.scanner.scan(response=response)
        if output_result.action == Action.BLOCK:
            return "Response blocked - contains sensitive data."

        return response
```

## Response Templates

```
SAFE:
(no response needed - process normally)

WARN:
"Your message may contain sensitive information. Proceed with caution."

BLOCK (injection):
"Request blocked - potential security threat detected."

BLOCK (data leakage):
"Response blocked - contains sensitive data that cannot be shared."

BLOCK (url filtering):
"Content blocked - malicious URL detected."
```

## Troubleshooting

### API Connection Failed
- Verify `PANW_AI_SEC_API_KEY` is set
- Run `uv run prisma-airs-audit` to diagnose
- Check network connectivity to API endpoint
- Confirm API subscription is active

### Profile Not Found
- Verify profile name exists in Prisma AIRS console
- Check profile_name in config matches exactly

### False Positives
- Adjust profile sensitivity in Prisma AIRS console
- Contact Palo Alto support for tuning

## Links

- [Prisma AIRS Documentation](https://docs.paloaltonetworks.com/prisma/prisma-cloud/prisma-cloud-ai-security)
- [pan-aisecurity SDK](https://pypi.org/project/pan-aisecurity/)
- [API Reference](https://pan.dev/prisma-airs/)
