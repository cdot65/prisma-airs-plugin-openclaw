# Prisma AIRS Plugin

OpenClaw plugin for [Prisma AIRS](https://www.paloaltonetworks.com/prisma/ai-runtime-security) (AI Runtime Security) from Palo Alto Networks.

## Overview

Bundles Prisma AIRS security scanning into OpenClaw agents using the official `pan-aisecurity` SDK:

- **Skill**: `prisma-airs` - Scanning commands and Python API
- **Hook**: `prisma-airs-guard` - Bootstrap reminder for consistent security scanning

Detection capabilities:
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
# Install plugin
openclaw plugins install ./prisma-airs-plugin

# Set API key (from Strata Cloud Manager)
export PANW_AI_SEC_API_KEY="your-api-key"

# Test scan
prisma-airs-scan "test message"
```

## Installation

### Plugin Install

```bash
openclaw plugins install ./prisma-airs-plugin
```

### Development

```bash
git clone https://github.com/cdot65/prisma-airs-plugin-openclaw.git
cd prisma-airs-plugin-openclaw
uv sync
```

## Plugin Structure

```
prisma-airs-plugin/
├── package.json
├── openclaw.plugin.json          # Plugin manifest
├── index.ts                      # Plugin entrypoint
├── src/prisma_airs_skill/        # Python package
│   ├── __init__.py
│   ├── scan.py
│   └── audit.py
├── skills/prisma-airs/           # Skill definition
│   ├── SKILL.md
│   ├── requirements.txt
│   └── scripts/
│       ├── scan.py
│       └── audit.py
└── hooks/prisma-airs-guard/      # Bootstrap reminder hook
    ├── HOOK.md
    └── handler.ts
```

## Configuration

### Plugin Config

```yaml
plugins:
  prisma-airs:
    profile_name: "default"       # SCM profile name
    app_name: "openclaw"          # App metadata
    reminder_enabled: true        # Enable bootstrap hook
```

### Where to Configure What

| Setting | Where |
|---------|-------|
| API key | Environment variable `PANW_AI_SEC_API_KEY` |
| Profile name | Plugin config or `config.yaml` |
| Rate limiting, logging | `config.yaml` |
| Detection services | Strata Cloud Manager |
| Actions (allow/block) | Strata Cloud Manager |
| DLP patterns | Strata Cloud Manager |

**Important**: Detection services and actions are configured in [Strata Cloud Manager](https://docs.paloaltonetworks.com/ai-runtime-security/administration/prevent-network-security-threats/api-intercept-create-configure-security-profile), not in plugin config.

### API Key Setup

1. Log in to Strata Cloud Manager
2. Navigate to **Settings** → **Access Keys**
3. Create a new access key for AI Security
4. Set the environment variable:

```bash
export PANW_AI_SEC_API_KEY="your-api-key"
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

# Session tracking
uv run prisma-airs-scan --session-id "sess-123" --tr-id "tx-001" "message"

# With metadata
uv run prisma-airs-scan --app-name "myapp" --ai-model "gpt-4" "message"

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
    context={"user_id": "123"},
    session_id="conversation-123",
    tr_id="tx-001",
    app_name="my-agent",
    app_user="user@example.com",
    ai_model="gpt-4",
)

if result.action == Action.BLOCK:
    print("Request blocked for security reasons.")
else:
    print(f"Scan passed: {result.categories}")
```

## Bootstrap Hook

The `prisma-airs-guard` hook injects a security reminder into agent bootstrap, instructing agents to:

1. Scan suspicious content before processing
2. Block requests with `action=BLOCK` response
3. Scan content involving code, URLs, or sensitive data

Disable via config:
```yaml
plugins:
  prisma-airs:
    reminder_enabled: false
```

## Detection Categories

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
- Node.js 18+ (for hook)
- Prisma AIRS API key (from Strata Cloud Manager)
- API Security Profile configured in SCM

## Links

- [Prisma AIRS Documentation](https://docs.paloaltonetworks.com/ai-runtime-security)
- [API Security Profile Setup](https://docs.paloaltonetworks.com/ai-runtime-security/administration/prevent-network-security-threats/api-intercept-create-configure-security-profile)
- [pan-aisecurity SDK](https://pypi.org/project/pan-aisecurity/)
- [API Reference](https://pan.dev/prisma-airs/)

## License

MIT
