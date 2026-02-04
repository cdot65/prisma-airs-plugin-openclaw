# Configuration Reference

## Configuration Hierarchy

```
1. Strata Cloud Manager (SCM)
   └── Security profiles, detection rules, actions, DLP patterns

2. Environment Variables
   └── PANW_AI_SEC_API_KEY (required)
   └── PANW_AI_SEC_PROFILE_NAME (optional)

3. OpenClaw Plugin Config
   └── Hook toggles, local enforcement behavior
```

!!! warning "Guardrails Are in SCM"
This plugin does NOT configure AI guardrails. All detection services, sensitivity levels, and actions are configured in **Strata Cloud Manager**. The plugin simply points to your SCM security profile and enforces the actions it returns.

## Environment Variables

| Variable                   | Required | Default     | Description                       |
| -------------------------- | -------- | ----------- | --------------------------------- |
| `PANW_AI_SEC_API_KEY`      | **Yes**  | —           | API key from Strata Cloud Manager |
| `PANW_AI_SEC_PROFILE_NAME` | No       | `"default"` | Security profile name from SCM    |

### Setting Environment Variables

```bash
# On the gateway node
export PANW_AI_SEC_API_KEY="your-api-key-here"
export PANW_AI_SEC_PROFILE_NAME="AI-Firewall-High-Security-Profile"
```

## Plugin Configuration

Plugin config controls **local behavior only**. Add to OpenClaw config:

```yaml
plugins:
  prisma-airs:
    enabled: true
    config:
      # Core settings
      profile_name: "default" # Overrides env var if set
      app_name: "openclaw" # For scan metadata

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
        - write
        - edit
        - gateway
        - message
        - cron
```

## Core Settings

### profile_name

| Property | Value                      |
| -------- | -------------------------- |
| Type     | `string`                   |
| Default  | `"default"`                |
| Env Var  | `PANW_AI_SEC_PROFILE_NAME` |

Security profile name from Strata Cloud Manager. Config value overrides env var.

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
`malicious_code`, `malicious_url`, `toxicity`, `agent_threat`,
`prompt_injection`, `db_security`, `scan-failure`

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

```bash
# Environment variables only - no plugin config needed
export PANW_AI_SEC_API_KEY="your-key"
export PANW_AI_SEC_PROFILE_NAME="your-profile"
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
