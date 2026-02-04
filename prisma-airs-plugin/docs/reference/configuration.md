# Configuration Reference

Complete reference for all configuration options.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PANW_AI_SEC_API_KEY` | **Yes** | — | Prisma AIRS API key from Strata Cloud Manager |

## Plugin Configuration

All options are configured under `plugins.prisma-airs` in your OpenClaw config:

```yaml
plugins:
  prisma-airs:
    # Core settings
    profile_name: "default"
    app_name: "openclaw"
    fail_closed: true

    # Hook toggles
    reminder_enabled: true
    audit_enabled: true
    context_injection_enabled: true
    outbound_scanning_enabled: true
    tool_gating_enabled: true

    # Feature settings
    dlp_mask_only: true
    high_risk_tools:
      - exec
      - Bash
      - write
      - edit
      - gateway
      - message
      - cron
```

## Core Settings

### profile_name

| Property | Value |
|----------|-------|
| Type | `string` |
| Default | `"default"` |
| Required | No |

The Prisma AIRS security profile name configured in Strata Cloud Manager.

```yaml
profile_name: "strict"
```

### app_name

| Property | Value |
|----------|-------|
| Type | `string` |
| Default | `"openclaw"` |
| Required | No |

Application identifier included in scan metadata for reporting.

```yaml
app_name: "my-agent"
```

### fail_closed

| Property | Value |
|----------|-------|
| Type | `boolean` |
| Default | `true` |
| Required | No |

When `true`, scan failures result in blocked requests. When `false`, scan failures allow requests through.

```yaml
fail_closed: true   # Security-first (default)
fail_closed: false  # Availability-first
```

## Hook Toggles

### reminder_enabled

| Property | Value |
|----------|-------|
| Type | `boolean` |
| Default | `true` |
| Hook | `prisma-airs-guard` |

Enable/disable the bootstrap security reminder.

### audit_enabled

| Property | Value |
|----------|-------|
| Type | `boolean` |
| Default | `true` |
| Hook | `prisma-airs-audit` |

Enable/disable inbound message audit logging.

### context_injection_enabled

| Property | Value |
|----------|-------|
| Type | `boolean` |
| Default | `true` |
| Hook | `prisma-airs-context` |

Enable/disable threat warning injection into agent context.

### outbound_scanning_enabled

| Property | Value |
|----------|-------|
| Type | `boolean` |
| Default | `true` |
| Hook | `prisma-airs-outbound` |

Enable/disable outbound response scanning.

### tool_gating_enabled

| Property | Value |
|----------|-------|
| Type | `boolean` |
| Default | `true` |
| Hook | `prisma-airs-tools` |

Enable/disable tool blocking during active threats.

## Feature Settings

### dlp_mask_only

| Property | Value |
|----------|-------|
| Type | `boolean` |
| Default | `true` |
| Hook | `prisma-airs-outbound` |

When `true`, DLP violations are masked instead of blocked. When `false`, DLP violations result in blocked responses.

```yaml
dlp_mask_only: true   # Mask sensitive data (default)
dlp_mask_only: false  # Block response entirely
```

!!! note "Always-Block Categories"
    Regardless of this setting, these categories always block:
    `malicious_code`, `malicious_url`, `toxicity`, `agent_threat`,
    `prompt_injection`, `db_security`, `scan-failure`

### high_risk_tools

| Property | Value |
|----------|-------|
| Type | `string[]` |
| Default | See below |
| Hook | `prisma-airs-tools` |

Tools to block when ANY threat is detected.

Default value:
```yaml
high_risk_tools:
  - exec
  - Bash
  - bash
  - write
  - Write
  - edit
  - Edit
  - gateway
  - message
  - cron
```

Custom configuration:
```yaml
high_risk_tools:
  - exec
  - Bash
  - write
  - deploy        # Custom tool
  - kubectl       # Custom tool
```

## Configuration Profiles

### Maximum Security

```yaml
plugins:
  prisma-airs:
    profile_name: "strict"
    fail_closed: true
    dlp_mask_only: false
    reminder_enabled: true
    audit_enabled: true
    context_injection_enabled: true
    outbound_scanning_enabled: true
    tool_gating_enabled: true
    high_risk_tools:
      - exec
      - Bash
      - write
      - edit
      - gateway
      - message
      - cron
      - browser
      - WebFetch
      - eval
```

### Balanced

```yaml
plugins:
  prisma-airs:
    profile_name: "default"
    fail_closed: true
    dlp_mask_only: true
    reminder_enabled: true
    audit_enabled: true
    context_injection_enabled: true
    outbound_scanning_enabled: true
    tool_gating_enabled: true
```

### High Availability

```yaml
plugins:
  prisma-airs:
    profile_name: "permissive"
    fail_closed: false
    dlp_mask_only: true
    reminder_enabled: true
    audit_enabled: true
    context_injection_enabled: true
    outbound_scanning_enabled: true
    tool_gating_enabled: true
```

### Audit Only

```yaml
plugins:
  prisma-airs:
    fail_closed: false
    reminder_enabled: false
    audit_enabled: true
    context_injection_enabled: false
    outbound_scanning_enabled: false
    tool_gating_enabled: false
```

### Development

```yaml
plugins:
  prisma-airs:
    profile_name: "dev"
    fail_closed: false
    dlp_mask_only: true
    reminder_enabled: false
    audit_enabled: true
    context_injection_enabled: false
    outbound_scanning_enabled: false
    tool_gating_enabled: false
```

## Strata Cloud Manager Configuration

These settings are configured in SCM, not the plugin:

| Setting | Location | Description |
|---------|----------|-------------|
| Detection services | Security Profiles | Which threats to detect |
| Actions | Security Profiles | allow/alert/block per detection |
| DLP patterns | Data Loss Prevention | PII, credential patterns |
| URL categories | URL Filtering | Allowed/blocked categories |
| Custom topics | Topic Guardrails | Organization policies |
