# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2025-01-31

### Added

- Session tracking: `session_id` param to group related scans
- Transaction correlation: `tr_id` param for prompt/response pairing
- Metadata support: `app_name`, `app_user`, `ai_model` params
- Config-based metadata defaults (app_name defaults to "openclaw")
- New CLI args: `--session-id`, `--tr-id`, `--app-name`, `--app-user`, `--ai-model`
- `ScanResult.session_id` and `ScanResult.tr_id` fields

## [0.1.0] - 2025-01-31

### Added

- Initial release
- `PrismaAIRS` scanner class using official `pan-aisecurity` SDK
- CLI tools: `prisma-airs-scan`, `prisma-airs-audit`
- YAML configuration support with environment variable interpolation
- Per-user rate limiting
- Security logging to file
- Detection categories: prompt injection, DLP (prompt/response), URL filtering
- Action enums: ALLOW, WARN, BLOCK
- Severity enums: SAFE, LOW, MEDIUM, HIGH, CRITICAL
