---
name: prisma-airs-guard
description: "Injects security scanning reminder into agent bootstrap context"
metadata:
  openclaw:
    emoji: "🛡"
    events:
      - agent:bootstrap
    requires:
      env:
        - PANW_AI_SEC_API_KEY
---

# Prisma AIRS Security Reminder

Injects security scanning reminder into agent bootstrap context.

## What It Does

When an agent bootstraps, this hook appends a system prompt reminder instructing the agent to:

1. Scan suspicious content using the `prisma_airs_scan` tool before processing
2. Block requests that return `action="block"`
3. Scan content involving sensitive data, code, or security-related requests

## Configuration

Enable/disable via plugin config:

```yaml
plugins:
  prisma-airs:
    reminder_enabled: true # default
```

## Requirements

- `PANW_AI_SEC_API_KEY` environment variable must be set
