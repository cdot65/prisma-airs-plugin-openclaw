---
name: prisma-airs-guard
description: "Injects security scanning reminder into agent bootstrap context"
metadata:
  openclaw:
    emoji: "🛡"
    events:
      - before_agent_start
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
    config:
      reminder_mode: "on" # default ("on" / "off")
```

## Requirements

- API key must be set in plugin config (`api_key`)
