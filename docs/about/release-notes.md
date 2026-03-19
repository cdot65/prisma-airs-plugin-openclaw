# Release Notes

Full release history for the Prisma AIRS plugin.

## v0.3.0 - Full Security Suite

**Released**: 2026-03-17

### New Features

- **12 hooks** covering 9 OpenClaw event types:
    - `prisma-airs-guard` -- `before_agent_start`, security reminder injection
    - `prisma-airs-audit` -- `message_received`, audit logging + scan cache
    - `prisma-airs-context` -- `before_agent_start`, threat warning injection
    - `prisma-airs-prompt-scan` -- `before_prompt_build`, full context scanning
    - `prisma-airs-inbound-block` -- `before_message_write`, hard block user messages
    - `prisma-airs-outbound-block` -- `before_message_write`, hard block assistant messages
    - `prisma-airs-outbound` -- `message_sending`, response scanning/blocking/DLP masking
    - `prisma-airs-tools` -- `before_tool_call`, cache-based tool gating
    - `prisma-airs-tool-guard` -- `before_tool_call`, active AIRS scanning of tool inputs
    - `prisma-airs-tool-redact` -- `tool_result_persist`, regex DLP redaction of tool outputs
    - `prisma-airs-llm-audit` -- `llm_input`/`llm_output`, LLM I/O audit logging
    - `prisma-airs-tool-audit` -- `after_tool_call`, tool output audit logging
- **Per-hook configuration**: 12 mode fields, each `deterministic`/`off` (4 support `probabilistic`)
- **Scanning modes**: `deterministic`, `probabilistic`, `off` per feature
- **`fail_closed` + `probabilistic` validation**: startup error if incompatible
- **Tool event scanning**: `toolEvent` content type for tool-guard hook
- **Hard guardrails**: `before_message_write` hooks block at persistence layer
- **164+ tests** across 15 test files
- **Docker E2E**: `docker-compose.yml`, `Dockerfile.e2e`, `entrypoint.sh`, 7-test smoke suite
- **SDK dependency**: `@cdot65/prisma-airs-sdk` ^0.6.7 handles HTTP, auth, retries

### Configuration (16 fields)

`api_key`, `profile_name`, `app_name`, `reminder_mode`, `audit_mode`, `context_injection_mode`, `outbound_mode`, `tool_gating_mode`, `inbound_block_mode`, `outbound_block_mode`, `tool_guard_mode`, `prompt_scan_mode`, `tool_redact_mode`, `llm_audit_mode`, `tool_audit_mode`, `fail_closed`, `dlp_mask_only`, `high_risk_tools`

---

## v0.2.5 - Stable Release & Docker Support

**Released**: 2025-02-14

- Dropped alpha prerelease tag (0.2.5-alpha.0 to 0.2.5)
- Moved docs to repo root (MkDocs site)
- Added Docker deployment guide and base Dockerfile
- API key via plugin config only (env var removed from docs)

---

## v0.2.4 - Config API Key & Hook Registration

**Released**: 2025-02-12

### Breaking Changes

- API key moved from `PANW_AI_SEC_API_KEY` env var to plugin config `api_key`
- `apiKey` removed from `ScanRequest`; SDK initialized once via `init({ apiKey })` in `register()`
- `scan()` checks `globalConfiguration.initialized` instead of requiring apiKey per call

### Changes

- Hook registration via `api.on()` adapters instead of `registerPluginHooksFromDir`
- `ContentErrorType` and `ErrorStatus` re-exported from SDK
- Removed `requires.env` from plugin manifest

---

## v0.2.0 - Multi-Layer Security Architecture

**Released**: 2024-02-04

### Breaking Changes

- `fail_closed` now defaults to `true`

### New Features

- 4 new hooks: audit, context, outbound, tools
- Scan result caching between hooks (30s TTL)
- DLP masking for sensitive data in responses
- Tool blocking based on threat categories
- Fail-closed mode for scan failures

---

## v0.1.4 - OpenClaw v2026.2.1 Compatibility

**Released**: 2024-02-04

- Fixed breaking API change: `handler` to `execute` with `_id` parameter

---

## v0.1.3 - Initial npm Publish

**Released**: 2024-02-03

- First npm release as `@cdot65/prisma-airs`
- OIDC trusted publishing via GitHub Actions

---

## v0.1.2 - Hook System

**Released**: 2024-02-02

- Added `prisma-airs-guard` bootstrap reminder hook

---

## v0.1.1 - Agent Tool

**Released**: 2024-02-01

- Added `prisma_airs_scan` agent tool
- CLI commands: `openclaw prisma-airs`, `openclaw prisma-airs-scan`

---

## v0.1.0 - Initial Release

**Released**: 2024-01-31

- Gateway RPC method: `prisma-airs.scan`
- TypeScript scanner with direct AIRS API integration
- Basic plugin manifest and configuration

## Upgrade Guide

### v0.2.x to v0.3.0

1. Review new hooks -- all default to `deterministic`. Disable any you do not need:

    ```json
    {
      "inbound_block_mode": "off",
      "outbound_block_mode": "off",
      "tool_guard_mode": "off",
      "prompt_scan_mode": "off",
      "tool_redact_mode": "off",
      "llm_audit_mode": "off",
      "tool_audit_mode": "off"
    }
    ```

2. Update OpenClaw to a version supporting the new hook events (`before_message_write`, `before_prompt_build`, `tool_result_persist`, `llm_input`, `llm_output`, `after_tool_call`)

3. Reinstall plugin:

    ```bash
    openclaw plugins uninstall prisma-airs
    openclaw plugins install @cdot65/prisma-airs
    openclaw gateway restart
    ```

### v0.1.x to v0.2.0

1. `fail_closed` now defaults to `true`. Set `fail_closed: false` if you want previous behavior.
2. All new hooks default to `deterministic`. Disable with `"off"` if needed.
3. Requires OpenClaw v2026.2.1+.

## Roadmap

- [ ] AIRS API match offsets for precision DLP masking
- [ ] Rate limiting for API calls
- [ ] Circuit breaker for fail modes
- [ ] Metrics export (Prometheus/OpenTelemetry)

## Feature Requests

Open an issue on [GitHub](https://github.com/cdot65/prisma-airs-plugin-openclaw/issues).
