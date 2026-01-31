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

- **In scope**: The prisma-airs-skill code itself
- **Out of scope**: The Prisma AIRS service (report to Palo Alto Networks)
- **Out of scope**: The pan-aisecurity SDK (report to Palo Alto Networks)
- **Out of scope**: Dependencies (report to respective maintainers)

## Security Best Practices

When using this skill:

1. Never commit `config.yaml` with API keys (it's in `.gitignore`)
2. Use environment variables for credentials
3. Review logs for unusual scan patterns
4. Keep the `pan-aisecurity` SDK updated
