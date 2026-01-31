---
name: prisma-airs
version: 0.1.0
description: Prisma AIRS (AI Runtime Security) integration for OpenClaw using the official pan-aisecurity SDK. Scans prompts and responses through Palo Alto Networks AI security service for injection attacks, data leakage, malicious URLs, and PII detection.
---

# Prisma AIRS Skill

AI Runtime Security scanning for OpenClaw agents via Palo Alto Networks Prisma AIRS.

## What's New in 0.1.0

- Initial release with official `pan-aisecurity` SDK
- Sync scanning for prompts and responses
- CLI tools for testing and configuration validation
- YAML config with environment variable support
- Per-user rate limiting

## What It Does

Uses the official `pan-aisecurity` SDK to scan prompts/responses:

- **Prompt Injection Detection** - Catches manipulation attempts
- **Data Leakage Prevention (DLP)** - Blocks sensitive data exposure
- **URL Filtering** - Identifies malicious URLs
- **PII Protection** - Detects personally identifiable information

## Quick Start

### ClawHub Install

```bash
claw install prisma-airs
```

### Manual Install

```bash
pip install -r requirements.txt
```

### Basic Usage

```python
from prisma_airs_skill import PrismaAIRS

scanner = PrismaAIRS()
result = scanner.scan("user message", context={"user_id": "123"})

if result.action.value == "block":
    return "Request blocked by security policy."
```

## Configuration

### Getting Your API Key

1. Log in to [Prisma Cloud Console](https://apps.paloaltonetworks.com/)
2. Navigate to **Settings** → **Access Keys**
3. Create a new access key for AI Security
4. Copy the API key (shown only once)

### Setting the API Key

**Option 1: Environment Variable (Recommended)**

```bash
# Add to ~/.bashrc, ~/.zshrc, or your shell profile
export PANW_AI_SEC_API_KEY="your-api-key-here"
```

**Option 2: Local config.yaml** (not uploaded to ClawHub)

```yaml
prisma_airs:
  api_key: "${PANW_AI_SEC_API_KEY}"  # Still uses env var
  profile_name: "default"
```

**Option 3: Direct in code** (not recommended for production)

```python
scanner = PrismaAIRS(api_key="your-key")
```

### Verify Setup

```bash
uv run prisma-airs-audit
# Or standalone:
python3 scripts/audit.py
```

## Security Levels

| Severity | Description | Typical Response |
|----------|-------------|------------------|
| SAFE | No threats detected | Process normally |
| LOW | Minor concern | Log for review |
| MEDIUM | Detection triggered | Review recommended |
| HIGH | Significant threat | Block + investigate |
| CRITICAL | Active attack/severe exposure | Block + alert |

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

### Standalone Scripts

```bash
# Direct execution (no uv required)
python3 scripts/scan.py --help
python3 scripts/audit.py --help
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

### Rate Limit Exceeded

- Default: 100 requests per 60 seconds per user
- Adjust in config.yaml under `rate_limit` section
- Consider implementing request queuing

### False Positives

- Adjust profile sensitivity in Prisma AIRS console
- Contact Palo Alto support for tuning

## Links

- [Prisma AIRS Documentation](https://docs.paloaltonetworks.com/prisma/prisma-cloud/prisma-cloud-ai-security)
- [pan-aisecurity SDK](https://pypi.org/project/pan-aisecurity/)
- [API Reference](https://pan.dev/prisma-airs/)
