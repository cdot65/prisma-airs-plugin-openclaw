# Release Notes

Full release history for the Prisma AIRS plugin.

For detailed release notes including design decisions, see [RELEASE_NOTES.md](https://github.com/cdot65/prisma-airs-plugin-openclaw/blob/main/RELEASE_NOTES.md) in the repository root.

## Version History

### v0.2.0 - Multi-Layer Security Architecture

**Released**: 2024-02-04

#### Breaking Changes

- `fail_closed` now defaults to `true`

#### New Features

- 4 new security hooks:
  - `prisma-airs-audit` - Audit logging with scan caching
  - `prisma-airs-context` - Threat warning injection
  - `prisma-airs-outbound` - Response scanning/blocking/masking
  - `prisma-airs-tools` - Tool gating
- Scan result caching between hooks (30s TTL)
- DLP masking for sensitive data in responses
- Tool blocking based on threat categories
- Fail-closed mode for scan failures

#### Design Decisions

See [Design Decisions](../architecture/design-decisions.md) for detailed rationale.

---

### v0.1.4 - OpenClaw v2026.2.1 Compatibility

**Released**: 2024-02-04

- Fixed breaking API change: `handler` → `execute` with `_id` parameter
- Updated tool result format

---

### v0.1.3 - Initial npm Publish

**Released**: 2024-02-03

- First npm release as `@cdot65/prisma-airs`
- OIDC trusted publishing via GitHub Actions

---

### v0.1.2 - Hook System

**Released**: 2024-02-02

- Added `prisma-airs-guard` bootstrap reminder hook
- Plugin hook registration via `registerPluginHooksFromDir`

---

### v0.1.1 - Agent Tool

**Released**: 2024-02-01

- Added `prisma_airs_scan` agent tool
- CLI commands: `openclaw prisma-airs`, `openclaw prisma-airs-scan`

---

### v0.1.0 - Initial Release

**Released**: 2024-01-31

- Gateway RPC method: `prisma-airs.scan`
- TypeScript scanner with direct AIRS API integration
- Basic plugin manifest and configuration

## Upgrade Guide

### v0.1.x to v0.2.0

1. **Review fail_closed change**:

   ```yaml
   plugins:
     prisma-airs:
       # Add if you want previous behavior
       fail_closed: false
   ```

2. **Review new hooks**: All new hooks are enabled by default. Disable if needed:

   ```yaml
   plugins:
     prisma-airs:
       audit_enabled: false
       context_injection_enabled: false
       outbound_scanning_enabled: false
       tool_gating_enabled: false
   ```

3. **Update OpenClaw**: Requires v2026.2.1+

4. **Reinstall plugin**:
   ```bash
   openclaw plugins uninstall prisma-airs
   openclaw plugins install @cdot65/prisma-airs
   openclaw gateway restart
   ```

## Roadmap

### Planned Features

- [ ] AIRS API match offsets for precision DLP masking
- [ ] Rate limiting for API calls
- [ ] Async scanning for high-throughput deployments
- [ ] Custom category-to-tool blocking rules
- [ ] Circuit breaker for fail modes
- [ ] Metrics export (Prometheus/OpenTelemetry)

### Feature Requests

Open an issue on [GitHub](https://github.com/cdot65/prisma-airs-plugin-openclaw/issues).
