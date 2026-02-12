# Configuration Reference

## Configuration Hierarchy

```
1. Strata Cloud Manager (SCM)
   └── Security profiles, detection rules, actions, DLP patterns

2. OpenClaw Plugin Config
   └── api_key (required)
   └── profile_name, app_name
   └── Hook toggles, local enforcement behavior
```

!!! warning "Guardrails Are in SCM"
This plugin does NOT configure AI guardrails. All detection services, sensitivity levels, and actions are configured in **Strata Cloud Manager**. The plugin simply points to your SCM security profile and enforces the actions it returns.

## Plugin Configuration

Add to OpenClaw config (via gateway web UI or config file):

```yaml
plugins:
  prisma-airs:
    enabled: true
    config:
      # API key (required)
      api_key: "your-api-key-here"

      # Core settings
      profile_name: "default"
      app_name: "openclaw"

      # Hook toggles
      reminder_enabled: true
      audit_enabled: true
      context_injection_enabled: true
      outbound_scanning_enabled: true
      tool_gating_enabled: true

      # Local enforcement
      fail_closed: true
      dlp_mask_only: true
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

## Core Settings

### profile_name

| Property | Value       |
| -------- | ----------- |
| Type     | `string`    |
| Default  | `"default"` |

Security profile name from Strata Cloud Manager.

### app_name

| Property | Value        |
| -------- | ------------ |
| Type     | `string`     |
| Default  | `"openclaw"` |

Application identifier included in scan metadata for SCM reporting.

## Hook Toggles

| Option                      | Type    | Default | Hook                 |
| --------------------------- | ------- | ------- | -------------------- |
| `reminder_enabled`          | boolean | `true`  | prisma-airs-guard    |
| `audit_enabled`             | boolean | `true`  | prisma-airs-audit    |
| `context_injection_enabled` | boolean | `true`  | prisma-airs-context  |
| `outbound_scanning_enabled` | boolean | `true`  | prisma-airs-outbound |
| `tool_gating_enabled`       | boolean | `true`  | prisma-airs-tools    |

## Local Enforcement Settings

These control how the plugin responds locally—NOT what AIRS detects.

### fail_closed

| Property | Value     |
| -------- | --------- |
| Type     | `boolean` |
| Default  | `true`    |

When `true`, scan failures (API errors, timeouts) result in blocked requests. When `false`, failures allow requests through.

### dlp_mask_only

| Property | Value     |
| -------- | --------- |
| Type     | `boolean` |
| Default  | `true`    |

When `true`, DLP violations are masked instead of blocked. When `false`, DLP violations block the response entirely.

!!! note "Always-Block Categories"
Regardless of `dlp_mask_only`, these categories always block:
`malicious_code*`, `malicious_url`, `toxicity`, `toxic_content*`,
`agent_threat*`, `prompt_injection`, `db_security*`, `scan-failure`
(includes suffixed variants like `malicious_code_response`)

### high_risk_tools

| Property | Value      |
| -------- | ---------- |
| Type     | `string[]` |
| Default  | See below  |

Tools to block when ANY threat is detected (not just specific categories).

Default:

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

## Strata Cloud Manager Settings

These are configured in SCM, **not** the plugin:

| Setting            | SCM Location         | Description                     |
| ------------------ | -------------------- | ------------------------------- |
| Detection services | Security Profiles    | Which threats to detect         |
| Actions            | Security Profiles    | allow/alert/block per detection |
| Sensitivity        | Security Profiles    | Detection thresholds            |
| DLP patterns       | Data Loss Prevention | PII, credential patterns        |
| URL categories     | URL Filtering        | Allowed/blocked URL categories  |
| Custom topics      | Topic Guardrails     | Organization policies           |

## Example: Minimal Setup

```yaml
plugins:
  prisma-airs:
    config:
      api_key: "your-key"
```

All other settings use sensible defaults.

## Example: Audit Only Mode

```yaml
plugins:
  prisma-airs:
    config:
      audit_enabled: true
      context_injection_enabled: false
      outbound_scanning_enabled: false
      tool_gating_enabled: false
      fail_closed: false
```

## Example: Maximum Local Enforcement

```yaml
plugins:
  prisma-airs:
    config:
      fail_closed: true
      dlp_mask_only: false
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
        - NotebookEdit
```
