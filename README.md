# Prisma AIRS Skill

OpenClaw plugin for [Prisma AIRS](https://www.paloaltonetworks.com/prisma/ai-runtime-security) (AI Runtime Security) from Palo Alto Networks.

## Overview

Integrates Prisma AIRS security scanning into OpenClaw agents using the official `pan-aisecurity` SDK:
- Prompt injection detection
- Data leakage prevention (DLP)
- Malicious URL filtering
- PII/sensitive data protection

## Quick Start

```bash
# Install with uv
uv sync

# Set API key
export PANW_AI_SEC_API_KEY="your-api-key"

# Test scan
uv run prisma-airs-scan "test message"

# Or run directly
uv run python -m prisma_airs_skill.scan "test message"
```

## Installation

```bash
# Clone and install
git clone https://github.com/cdot65/prisma-airs-skill.git
cd prisma-airs-skill
uv sync

# Install dev dependencies
uv sync --dev
```

## Configuration

Set the API key via environment variable (recommended):

```bash
export PANW_AI_SEC_API_KEY="your-api-key"
```

Or use a config file:

```bash
cp config.example.yaml config.yaml
```

```yaml
prisma_airs:
  api_key: "${PANW_AI_SEC_API_KEY}"
  profile_name: "default"

  actions:
    injection: block
    dlp: block
    url_cats: block
    benign: allow
```

## Usage

### CLI

```bash
# Scan a prompt
uv run prisma-airs-scan "user input to scan"

# JSON output
uv run prisma-airs-scan --json "message"

# Specify profile
uv run prisma-airs-scan --profile strict "message"

# Scan prompt and response
uv run prisma-airs-scan --prompt "user msg" --response "ai response"

# Run audit
uv run prisma-airs-audit
```

### Python API

```python
from prisma_airs_skill import PrismaAIRS

scanner = PrismaAIRS(profile_name="default")
result = scanner.scan(
    prompt="user message",
    response="ai response",
    context={"user_id": "123"}
)

if result.action.value == "block":
    print("Request blocked for security reasons.")
else:
    print(f"Scan passed: {result.categories}")
```

## Detection Categories

| Category | Description | Default Action |
|----------|-------------|----------------|
| `prompt_injection` | Injection attack detected | Block |
| `dlp_prompt` | Sensitive data in prompt | Block |
| `dlp_response` | Sensitive data in response | Block |
| `url_filtering_prompt` | Malicious URL in prompt | Block |
| `url_filtering_response` | Malicious URL in response | Block |
| `safe` | No issues detected | Allow |

## Project Structure

```
prisma-airs-skill/
├── README.md
├── SKILL.md
├── pyproject.toml
├── config.example.yaml
└── src/
    └── prisma_airs_skill/
        ├── __init__.py
        ├── scan.py
        └── audit.py
```

## Development

```bash
# Install dev dependencies
uv sync --dev

# Run linting
uv run ruff check src/
uv run flake8 src/
uv run mypy src/

# Run tests
uv run pytest
```

## Requirements

- Python 3.9+
- Prisma AIRS API credentials (`PANW_AI_SEC_API_KEY`)
- Valid Palo Alto Networks subscription

## Links

- [Prisma AIRS Documentation](https://docs.paloaltonetworks.com/prisma/prisma-cloud/prisma-cloud-ai-security)
- [pan-aisecurity SDK](https://pypi.org/project/pan-aisecurity/)
- [API Reference](https://pan.dev/prisma-airs/api/)

## License

MIT
