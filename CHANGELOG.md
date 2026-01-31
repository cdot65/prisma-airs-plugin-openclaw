# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-01-31

### Added

- Initial release as OpenClaw plugin
- `prisma-airs` skill: AI Runtime Security scanning via Palo Alto Networks
- `prisma-airs-guard` hook: injects security scanning reminder on agent bootstrap
- `PrismaAIRS` scanner class using official `pan-aisecurity` SDK
- CLI tools: `prisma-airs-scan`, `prisma-airs-audit`
- Session tracking: `session_id` param to group related scans
- Transaction correlation: `tr_id` param for prompt/response pairing
- Metadata support: `app_name`, `app_user`, `ai_model` params
- YAML configuration support with environment variable interpolation
- Per-user rate limiting
- Security logging to file
- Detection categories: prompt injection, DLP (prompt/response), URL filtering
- Action enums: ALLOW, WARN, BLOCK
- Severity enums: SAFE, LOW, MEDIUM, HIGH, CRITICAL
- Plugin config schema for `profile_name`, `app_name`, `reminder_enabled`
