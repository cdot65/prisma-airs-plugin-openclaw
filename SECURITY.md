# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly:

1. **Do not** open a public GitHub issue for security vulnerabilities
2. Email your findings to the maintainers
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

## Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial assessment**: Within 1 week
- **Resolution target**: Depends on severity
  - Critical: 24-48 hours
  - High: 1 week
  - Medium: 2 weeks
  - Low: Next release

## Scope

This security policy covers vulnerabilities in:

- **In scope**: The prisma-airs-plugin code itself (TypeScript scanner, hook, RPC handlers)
- **Out of scope**: The Prisma AIRS service (report to Palo Alto Networks)
- **Out of scope**: Dependencies (report to respective maintainers)

## Security Best Practices

When using this plugin:

1. Set API key via plugin config (`api_key` field), never hardcode in source
2. Never commit API keys to version control
3. Monitor scan results for unusual patterns
4. Keep plugin dependencies updated (`npm update`)
