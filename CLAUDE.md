# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
uv sync
uv sync --dev  # includes dev tools

# Run all checks
make all  # format -> lint -> mypy -> test

# Individual commands
make format   # ruff format + fix
make lint     # ruff check + flake8
make mypy     # type checking
make test     # pytest

# CLI tools
uv run prisma-airs-scan "message"
uv run prisma-airs-scan --json "message"
uv run prisma-airs-scan --prompt "user msg" --response "ai response"
uv run prisma-airs-scan --session-id "sess-123" --tr-id "tx-001" "message"
uv run prisma-airs-scan --app-name "myapp" --ai-model "gpt-4" "message"
uv run prisma-airs-audit        # config validation
uv run prisma-airs-audit --quick  # skip connectivity test

# Standalone scripts (for ClawHub)
python3 scripts/scan.py --help
python3 scripts/audit.py --help
```

## Architecture

OpenClaw skill plugin wrapping the official `pan-aisecurity` SDK from Palo Alto Networks.

**Core components:**
- `src/prisma_airs_skill/scan.py` - Main `PrismaAIRS` class and `ScanResult` dataclass. Handles SDK initialization, config loading, rate limiting, and response parsing.
- `src/prisma_airs_skill/audit.py` - Config validation CLI (`prisma-airs-audit`)
- `scripts/scan.py`, `scripts/audit.py` - Standalone entry points for ClawHub

**Data flow:**
1. `PrismaAIRS.__init__` loads config from YAML or defaults, initializes `aisecurity` SDK
2. `scan()` builds `Content` + `Metadata` objects, calls `Scanner.sync_scan()`, returns `ScanResult`
3. SDK response parsed into categories based on detection flags

**Key types:**
- `Action` enum: ALLOW, WARN, BLOCK
- `Severity` enum: SAFE, LOW, MEDIUM, HIGH, CRITICAL
- `ScanResult` dataclass with action, severity, categories, scan_id, report_id, session_id, tr_id, detection dicts

## Config: Skill vs Strata Cloud Manager

**Important distinction**: Detection services and actions are configured in Strata Cloud Manager (SCM), NOT in `config.yaml`.

| Setting | Where to Configure |
|---------|-------------------|
| API key | `config.yaml` or env var `PANW_AI_SEC_API_KEY` |
| Profile name | `config.yaml` |
| Rate limiting, logging | `config.yaml` |
| Metadata defaults (app_name, app_user, ai_model) | `config.yaml` |
| Detection services (enable/disable) | Strata Cloud Manager |
| Actions (allow/block/alert) | Strata Cloud Manager |
| DLP patterns, URL categories | Strata Cloud Manager |

Set `PANW_AI_SEC_API_KEY` env var or use `config.yaml`. See `config.example.yaml` for local options.

## Detection Categories

Categories returned depend on SCM profile configuration:

| Category | Detection Service |
|----------|------------------|
| `prompt_injection` | Prompt Injection Detection |
| `dlp_prompt` | Sensitive Data Detection (prompt) |
| `dlp_response` | Sensitive Data Detection (response) |
| `url_filtering_prompt` | Malicious URL Detection (prompt) |
| `url_filtering_response` | Malicious URL Detection (response) |
| `toxic_content` | Toxic Content Detection |
| `db_security` | Database Security Detection |
| `malicious_code` | Malicious Code Detection |
| `ungrounded` | Contextual Grounding |
| `topic_violation` | Custom Topic Guardrails |
| `safe` | No threats detected |

## Project Structure

```
prisma-airs-skill/
├── src/prisma_airs_skill/   # Main package
│   ├── __init__.py
│   ├── scan.py              # PrismaAIRS class, CLI
│   └── audit.py             # Config audit CLI
├── scripts/                  # ClawHub standalone entry points
│   ├── scan.py
│   └── audit.py
├── blog/                     # Educational content
├── config.example.yaml       # Local config template
├── requirements.txt          # pip-compatible deps
├── SKILL.md                  # ClawHub skill documentation
├── CHANGELOG.md
└── SECURITY.md
```
