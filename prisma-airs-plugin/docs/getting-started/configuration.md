# Configuration

## Configuration Layers

The plugin uses two configuration sources:

| Source                    | Settings                                  |
| ------------------------- | ----------------------------------------- |
| **Environment Variables** | API key                                   |
| **Plugin Config**         | Profile, app name, feature toggles        |
| **Strata Cloud Manager**  | Detection services, actions, DLP patterns |

!!! warning "SCM vs Plugin Config"
Detection services and actions (allow/block/alert) are configured in **Strata Cloud Manager**, not in plugin config. The plugin config controls which hooks are enabled and their behavior.

## Environment Variables

| Variable              | Required | Description                       |
| --------------------- | -------- | --------------------------------- |
| `PANW_AI_SEC_API_KEY` | Yes      | API key from Strata Cloud Manager |

## Plugin Configuration

Add to your OpenClaw config file:

```yaml
plugins:
  prisma-airs:
    # AIRS profile name (configured in SCM)
    profile_name: "default"

    # Application name for scan metadata
    app_name: "openclaw"

    # Fail-closed mode (block on scan failure)
    fail_closed: true

    # Hook toggles
    reminder_enabled: true # prisma-airs-guard
    audit_enabled: true # prisma-airs-audit
    context_injection_enabled: true # prisma-airs-context
    outbound_scanning_enabled: true # prisma-airs-outbound
    tool_gating_enabled: true # prisma-airs-tools

    # DLP settings
    dlp_mask_only: true # Mask instead of block for DLP

    # Tool gating settings
    high_risk_tools:
      - exec
      - Bash
      - write
      - edit
      - gateway
      - message
      - cron
```

## Configuration Options

### Core Settings

| Option         | Type    | Default      | Description                      |
| -------------- | ------- | ------------ | -------------------------------- |
| `profile_name` | string  | `"default"`  | AIRS security profile name       |
| `app_name`     | string  | `"openclaw"` | Application identifier for scans |
| `fail_closed`  | boolean | `true`       | Block requests when scan fails   |

### Hook Toggles

| Option                      | Type    | Default | Hook                 |
| --------------------------- | ------- | ------- | -------------------- |
| `reminder_enabled`          | boolean | `true`  | prisma-airs-guard    |
| `audit_enabled`             | boolean | `true`  | prisma-airs-audit    |
| `context_injection_enabled` | boolean | `true`  | prisma-airs-context  |
| `outbound_scanning_enabled` | boolean | `true`  | prisma-airs-outbound |
| `tool_gating_enabled`       | boolean | `true`  | prisma-airs-tools    |

### DLP Settings

| Option          | Type    | Default | Description                             |
| --------------- | ------- | ------- | --------------------------------------- |
| `dlp_mask_only` | boolean | `true`  | Mask DLP violations instead of blocking |

### Tool Gating Settings

| Option            | Type     | Default   | Description                  |
| ----------------- | -------- | --------- | ---------------------------- |
| `high_risk_tools` | string[] | See below | Tools to block on any threat |

Default high-risk tools:

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

## Strata Cloud Manager Configuration

The following are configured in SCM, not the plugin:

### Security Profile

1. Navigate to **AI Runtime Security** → **Security Profiles**
2. Create or edit a profile
3. Enable detection services:
   - Prompt Injection Detection
   - Sensitive Data Protection (DLP)
   - URL Filtering
   - Toxic Content Detection
   - Database Security
   - Malicious Code Detection
   - AI Agent Protection
   - Contextual Grounding
   - Custom Topic Guardrails

### Actions

For each detection service, configure the action:

| Action  | Behavior                   |
| ------- | -------------------------- |
| `allow` | No action, scan only       |
| `alert` | Log warning, allow through |
| `block` | Block the request          |

### DLP Patterns

1. Navigate to **Data Loss Prevention**
2. Configure detection patterns for:
   - PII (SSN, credit cards, etc.)
   - Credentials (API keys, passwords)
   - Custom sensitive data

## Example Configurations

### High Security

```yaml
plugins:
  prisma-airs:
    profile_name: "strict"
    fail_closed: true
    dlp_mask_only: false # Block instead of mask
```

### Development/Testing

```yaml
plugins:
  prisma-airs:
    profile_name: "permissive"
    fail_closed: false
    outbound_scanning_enabled: false # Skip outbound scans
```

### Audit Only

```yaml
plugins:
  prisma-airs:
    audit_enabled: true
    context_injection_enabled: false
    outbound_scanning_enabled: false
    tool_gating_enabled: false
```
