# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
uv sync --dev

# Run all checks
make all  # format -> lint -> mypy -> test

# Individual commands
make format   # ruff format + fix
make lint     # ruff check + flake8
make mypy     # type checking
make test     # pytest (unit tests only, mocked)

# Run single test
uv run pytest tests/test_scan.py::TestPrismaAIRSScan::test_scan_with_session_id -v

# Integration tests (requires PANW_AI_SEC_API_KEY + config.yaml)
uv run pytest -m integration

# CLI tools
uv run prisma-airs-scan "message"
uv run prisma-airs-scan --json "message"
uv run prisma-airs-scan --prompt "user msg" --response "ai response"
uv run prisma-airs-scan --session-id "sess-123" --tr-id "tx-001" "message"
uv run prisma-airs-audit        # config validation
uv run prisma-airs-audit --quick  # skip connectivity test
```

## Architecture

OpenClaw plugin wrapping the official `pan-aisecurity` SDK from Palo Alto Networks. Bundles a skill and bootstrap reminder hook.

**Core components:**
- `prisma-airs-plugin/src/prisma_airs_skill/scan.py` - Main `PrismaAIRS` class and `ScanResult` dataclass. Handles SDK initialization, config loading, rate limiting, and response parsing.
- `prisma-airs-plugin/src/prisma_airs_skill/audit.py` - Config validation CLI (`prisma-airs-audit`)
- `prisma-airs-plugin/hooks/prisma-airs-guard/` - Bootstrap reminder hook

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

## Testing

- Unit tests mock the `aisecurity` SDK entirely via `patch("aisecurity.init")`, `patch("prisma_airs_skill.scan.Scanner")`, etc.
- Integration tests (`@pytest.mark.integration`) require live API key and skip automatically if not set
- `live_api` fixture: skips if `PANW_AI_SEC_API_KEY` not set
- `live_api_with_config`: also requires `config.yaml` to exist
- Coverage target: 90% (enforced via `--cov-fail-under=90`)
