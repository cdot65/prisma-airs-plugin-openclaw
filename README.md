# Prisma AIRS Skill

OpenClaw plugin for [Prisma AIRS](https://www.paloaltonetworks.com/prisma/ai-runtime-security) (AI Runtime Security) from Palo Alto Networks.

## Overview

Integrates Prisma AIRS security scanning into OpenClaw agents using the official `pan-aisecurity` SDK:

- Prompt injection detection
- Data leakage prevention (DLP)
- Malicious URL filtering
- Toxic content detection
- Database security
- Malicious code detection
- AI agent protection
- Contextual grounding
- Custom topic guardrails

## Quick Start

```bash
# Install with uv
uv sync

# Set API key (from Strata Cloud Manager)
export PANW_AI_SEC_API_KEY="your-api-key"

# Test scan
uv run prisma-airs-scan "test message"

# Validate configuration
uv run prisma-airs-audit
```

## Installation

### ClawHub

```bash
claw install prisma-airs
```

### Manual

```bash
git clone https://github.com/cdot65/prisma-airs-skill.git
cd prisma-airs-skill
uv sync
```

## Configuration

### Where to Configure What

| Setting | Where |
|---------|-------|
| API key | Environment variable or `config.yaml` |
| Profile name | `config.yaml` |
| Rate limiting, logging | `config.yaml` |
| Detection services | Strata Cloud Manager |
| Actions (allow/block) | Strata Cloud Manager |
| DLP patterns | Strata Cloud Manager |

**Important**: Detection services and their actions are configured in [Strata Cloud Manager](https://docs.paloaltonetworks.com/ai-runtime-security/administration/prevent-network-security-threats/api-intercept-create-configure-security-profile), not in this skill's config file.

### API Key Setup

1. Log in to Strata Cloud Manager
2. Navigate to **Settings** → **Access Keys**
3. Create a new access key for AI Security
4. Set the environment variable:

```bash
export PANW_AI_SEC_API_KEY="your-api-key"
```

### Config File (Optional)

```bash
cp config.example.yaml config.yaml
```

```yaml
prisma_airs:
  api_key: "${PANW_AI_SEC_API_KEY}"
  profile_name: "default"  # Must match profile in SCM

  logging:
    enabled: true
    path: "logs/prisma-airs.log"

  rate_limit:
    enabled: true
    max_requests: 100
    window_seconds: 60
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

# Run configuration audit
uv run prisma-airs-audit
```

### Python API

```python
from prisma_airs_skill import PrismaAIRS, Action

scanner = PrismaAIRS(profile_name="default")
result = scanner.scan(
    prompt="user message",
    response="ai response",
    context={"user_id": "123"}
)

if result.action == Action.BLOCK:
    print("Request blocked for security reasons.")
else:
    print(f"Scan passed: {result.categories}")
```

## Detection Categories

Categories returned depend on which services are enabled in your SCM profile:

| Category | Description |
|----------|-------------|
| `prompt_injection` | Injection attack detected |
| `dlp_prompt` | Sensitive data in prompt |
| `dlp_response` | Sensitive data in response |
| `url_filtering_prompt` | Malicious URL in prompt |
| `url_filtering_response` | Malicious URL in response |
| `toxic_content` | Harmful content detected |
| `db_security` | Dangerous database query |
| `malicious_code` | Harmful code detected |
| `ungrounded` | Response not grounded in context |
| `topic_violation` | Topic guardrail triggered |
| `safe` | No issues detected |

## Project Structure

```
prisma-airs-skill/
├── README.md
├── SKILL.md              # ClawHub skill documentation
├── CHANGELOG.md
├── SECURITY.md
├── pyproject.toml
├── requirements.txt
├── config.example.yaml
├── blog/                 # Educational content
├── scripts/              # Standalone entry points
│   ├── scan.py
│   └── audit.py
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

# Run all checks
make all

# Individual commands
make format   # ruff format + fix
make lint     # ruff check + flake8
make mypy     # type checking
make test     # pytest
```

## Requirements

- Python 3.9+
- Prisma AIRS API key (from Strata Cloud Manager)
- API Security Profile configured in SCM
- Valid Palo Alto Networks subscription

## Service Limitations

| Limitation | Value |
|------------|-------|
| Sync request payload | 2 MB max |
| Async request payload | 5 MB max |
| URLs per request | 100 max |
| API keys per profile | 1 |
| Cross-region API keys | Not supported |

## Links

- [Prisma AIRS Documentation](https://docs.paloaltonetworks.com/ai-runtime-security)
- [API Security Profile Setup](https://docs.paloaltonetworks.com/ai-runtime-security/administration/prevent-network-security-threats/api-intercept-create-configure-security-profile)
- [pan-aisecurity SDK](https://pypi.org/project/pan-aisecurity/)
- [API Reference](https://pan.dev/prisma-airs/)

## License

MIT
