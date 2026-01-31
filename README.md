# Prisma AIRS Skill

OpenClaw plugin for [Prisma AIRS](https://www.paloaltonetworks.com/prisma/ai-runtime-security) (AI Runtime Security) from Palo Alto Networks.

## Overview

Integrates Prisma AIRS security scanning into OpenClaw agents for:
- Prompt injection detection
- Data leakage prevention
- Malicious content detection
- PII/sensitive data protection

## Quick Start

```bash
# Install
clawdhub install prisma-airs

# Configure
cp config.example.yaml config.yaml
# Edit config.yaml with your Prisma AIRS credentials

# Test
python3 scripts/scan.py "test message"
```

## Configuration

```yaml
prisma_airs:
  api_url: "https://service.api.aisecurity.paloaltonetworks.com"
  api_key: "${PRISMA_AIRS_API_KEY}"
  profile_name: "default"

  actions:
    detected: block
    error: warn
    safe: allow
```

## Usage

### CLI

```bash
# Scan a message
python3 scripts/scan.py "user input to scan"

# JSON output
python3 scripts/scan.py --json "message"

# With profile
python3 scripts/scan.py --profile strict "message"
```

### Python API

```python
from scripts.scan import PrismaAIRS

scanner = PrismaAIRS(config_path="config.yaml")
result = scanner.scan(
    prompt="user message",
    context={"user_id": "123", "is_group": True}
)

if result.action == "block":
    return "Request blocked for security reasons."
```

## Security Levels

| Category | Description | Default Action |
|----------|-------------|----------------|
| prompt_injection | Injection attack detected | Block |
| data_leakage | Sensitive data exposure | Block |
| malicious_content | Harmful content detected | Block |
| pii_detected | PII in prompt | Warn |
| safe | No issues detected | Allow |

## Project Structure

```
prisma-airs-skill/
├── README.md              # This file
├── SKILL.md               # OpenClaw skill documentation
├── config.example.yaml    # Configuration template
├── requirements.txt       # Python dependencies
└── scripts/
    ├── scan.py            # Main scanning engine
    └── audit.py           # Configuration audit
```

## Requirements

- Python 3.8+
- Prisma AIRS API credentials
- Valid Palo Alto Networks subscription

## License

MIT
