# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
