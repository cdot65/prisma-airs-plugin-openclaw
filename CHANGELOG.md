# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0-alpha.0] - 2026-02-14

### Added

- Per-feature scanning modes: `deterministic`, `probabilistic`, `off`
- New config fields: `audit_mode`, `context_injection_mode`, `outbound_mode`, `tool_gating_mode`, `reminder_mode`
- 3 new probabilistic tools: `prisma_airs_scan_prompt`, `prisma_airs_scan_response`, `prisma_airs_check_tool_safety`
- Mode-aware guard reminder (adapts content to active modes)
- Config validation: `fail_closed=true` rejects probabilistic modes
- Centralized config module (`src/config.ts`) with `resolveMode()`, `resolveAllModes()`
- 26 new tests (93 total across 5 test files)

### Changed

- Hook registration is now conditional based on resolved mode
- Guard handler exports `buildReminder()`, `DETERMINISTIC_REMINDER`, `PROBABILISTIC_REMINDER`
- Tools handler exports `shouldBlockTool()`, `TOOL_BLOCKS`, `DEFAULT_HIGH_RISK_TOOLS`
- Outbound handler exports `maskSensitiveData()`, `shouldMaskOnly()`, `buildBlockMessage()`
- Status RPC response now includes `modes` object

### Removed

- Deprecated boolean config flags: `audit_enabled`, `context_injection_enabled`, `outbound_scanning_enabled`, `tool_gating_enabled`, `reminder_enabled`
  - Use `*_mode` fields instead

## [0.1.4] - 2026-02-04

### Changed

- **BREAKING**: Updated agent tool API for OpenClaw v2026.2.1+ compatibility
  - Changed `handler` to `execute` method signature
  - Added `_id: string` as first parameter
  - Return type now uses OpenClaw tool result format: `{ content: [{ type: "text", text: ... }] }`
- Added `entrypoint` field to `openclaw.plugin.json`

### Fixed

- Fixed `tool.execute is not a function` error on OpenClaw v2026.2.1+

## [0.1.0] - 2025-01-31

### Added

- Initial release as OpenClaw plugin
- Pure TypeScript implementation with direct AIRS API integration via `fetch()`
- Gateway RPC methods: `prisma-airs.scan`, `prisma-airs.status`
- Agent tool: `prisma_airs_scan`
- CLI commands: `prisma-airs`, `prisma-airs-scan`
- `prisma-airs-guard` hook: injects security scanning reminder on agent bootstrap
- Session tracking: `session_id` param to group related scans
- Transaction correlation: `tr_id` param for prompt/response pairing
- Metadata support: `app_name`, `app_user`, `ai_model` params
- Detection categories: prompt injection, DLP (prompt/response), URL filtering
- Action types: allow, warn, block
- Severity levels: SAFE, LOW, MEDIUM, HIGH, CRITICAL
- Plugin config schema for `profile_name`, `app_name`, `reminder_mode`
- Vitest test suite (22 tests)
- ESLint 9 + Prettier + TypeScript strict mode
- Pre-commit hooks via Husky + lint-staged
