---
name: prisma-airs
version: 0.1.0
description: Prisma AIRS (AI Runtime Security) integration for OpenClaw. Scans prompts and responses through Palo Alto Networks AI security service for injection attacks, data leakage, malicious content, and PII detection.
---

# Prisma AIRS Skill

AI Runtime Security scanning for OpenClaw agents via Palo Alto Networks Prisma AIRS.

## What It Does

Sends prompts/responses to Prisma AIRS API for security analysis:
- **Prompt Injection Detection** - Catches manipulation attempts
- **Data Leakage Prevention** - Blocks sensitive data exposure
- **Malicious Content Detection** - Identifies harmful content
- **PII Protection** - Detects personally identifiable information

## Quick Start

```python
from scripts.scan import PrismaAIRS

scanner = PrismaAIRS()
result = scanner.scan("user message", context={"user_id": "123"})

if result.action == "block":
    return "Request blocked by security policy."
```

## Configuration

Set credentials via environment or config file:

```bash
export PRISMA_AIRS_API_KEY="your-api-key"
```

Or in `config.yaml`:

```yaml
prisma_airs:
  api_url: "https://service.api.aisecurity.paloaltonetworks.com"
  api_key: "${PRISMA_AIRS_API_KEY}"
  profile_name: "default"
```

## Security Actions

| Detection | Action | Response |
|-----------|--------|----------|
| prompt_injection | block | Block request, log attempt |
| data_leakage | block | Block, notify owner |
| malicious_content | block | Block request |
| pii_detected | warn | Warn user, allow with logging |
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
        "chat_name": "general"
    }
)
```

**Returns:** `ScanResult` with:
- `action`: allow, warn, block
- `categories`: List of detected issues
- `details`: Raw API response
- `severity`: safe, low, medium, high, critical

## CLI Usage

```bash
# Basic scan
python3 scripts/scan.py "message"

# JSON output
python3 scripts/scan.py --json "message"

# Specify profile
python3 scripts/scan.py --profile strict "message"

# Scan with response
python3 scripts/scan.py --prompt "user msg" --response "ai response"
```

## Integration Example

```python
# In your OpenClaw agent
from scripts.scan import PrismaAIRS

class SecureAgent:
    def __init__(self):
        self.scanner = PrismaAIRS()

    async def process(self, user_input: str) -> str:
        # Scan input
        result = self.scanner.scan(user_input)
        if result.action == "block":
            return "Request blocked for security reasons."

        # Process with LLM
        response = await self.llm.generate(user_input)

        # Scan output
        output_result = self.scanner.scan(response=response)
        if output_result.action == "block":
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

BLOCK (malicious):
"Content blocked by security policy."
```

## Troubleshooting

### API Connection Failed
- Verify `PRISMA_AIRS_API_KEY` is set
- Check network connectivity to API endpoint
- Confirm API subscription is active

### False Positives
- Adjust profile sensitivity in Prisma AIRS console
- Use allowlist patterns in config
- Contact Palo Alto support for tuning

## Links

- [Prisma AIRS Documentation](https://docs.paloaltonetworks.com/prisma/prisma-cloud/prisma-cloud-ai-security)
- [API Reference](https://pan.dev/ai-runtime-security/)
- [Palo Alto Networks](https://www.paloaltonetworks.com/)
