# Configuration

## Important: Where to Configure What

| What to Configure                                                | Where                                 |
| ---------------------------------------------------------------- | ------------------------------------- |
| **Detection rules** (prompt injection, DLP, URL filtering, etc.) | Strata Cloud Manager                  |
| **Actions** (allow/alert/block per detection)                    | Strata Cloud Manager                  |
| **DLP patterns** (SSN, credit cards, API keys)                   | Strata Cloud Manager                  |
| **URL categories** (malware, phishing, adult)                    | Strata Cloud Manager                  |
| **Custom topics** (organization policies)                        | Strata Cloud Manager                  |
| **API key**                                                      | Environment variable                  |
| **Profile name**                                                 | Environment variable or plugin config |
| **Plugin behavior** (enable/disable hooks)                       | Plugin config                         |

!!! warning "All Guardrails Are in SCM"
This plugin does NOT configure AI guardrails. All detection services, sensitivity levels, and actions are configured in your **Strata Cloud Manager** tenant. The plugin simply points to your SCM security profile and applies local enforcement.

## Required: Environment Variables

| Variable                   | Required | Description                                  |
| -------------------------- | -------- | -------------------------------------------- |
| `PANW_AI_SEC_API_KEY`      | **Yes**  | API key from Strata Cloud Manager            |
| `PANW_AI_SEC_PROFILE_NAME` | No       | Security profile name (default: `"default"`) |

Set these on your gateway node:

```bash
export PANW_AI_SEC_API_KEY="your-api-key-here"
export PANW_AI_SEC_PROFILE_NAME="your-profile-name"  # optional
```

## Optional: Plugin Configuration

The plugin config controls **local behavior only** - not detection rules or guardrails.

```yaml
plugins:
  prisma-airs:
    enabled: true
    config:
      # Which SCM profile to use (overrides env var)
      profile_name: "default"

      # Application name for scan metadata/reporting
      app_name: "openclaw"
```

### Hook Toggles

Enable/disable individual hooks:

```yaml
plugins:
  prisma-airs:
    config:
      reminder_enabled: true # prisma-airs-guard
      audit_enabled: true # prisma-airs-audit
      context_injection_enabled: true # prisma-airs-context
      outbound_scanning_enabled: true # prisma-airs-outbound
      tool_gating_enabled: true # prisma-airs-tools
```

### Local Enforcement Settings

These control how the plugin responds locally, NOT what AIRS detects:

```yaml
plugins:
  prisma-airs:
    config:
      # Block messages when AIRS API is unreachable
      fail_closed: true

      # Mask DLP violations instead of blocking
      dlp_mask_only: true

      # Tools to block when ANY threat is detected
      high_risk_tools:
        - exec
        - Bash
        - write
        - edit
        - gateway
        - message
        - cron
```

## Strata Cloud Manager Setup

All detection configuration happens in SCM:

### 1. Get API Key

1. Log into [Strata Cloud Manager](https://stratacloudmanager.paloaltonetworks.com)
2. Navigate to **Settings** → **API Keys**
3. Create a new key with AIRS permissions
4. Copy the key to `PANW_AI_SEC_API_KEY`

### 2. Create Security Profile

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

### 3. Configure Actions

For each detection service, set the action:

| Action  | Behavior                   |
| ------- | -------------------------- |
| `allow` | Log only, no blocking      |
| `alert` | Log warning, allow through |
| `block` | Block the request          |

### 4. Configure DLP Patterns

1. Navigate to **Data Loss Prevention**
2. Configure detection patterns for PII, credentials, etc.

## Minimal Configuration

The absolute minimum to get started:

```bash
# Required
export PANW_AI_SEC_API_KEY="your-key"

# Optional - defaults to "default"
export PANW_AI_SEC_PROFILE_NAME="your-profile"
```

That's it. All other settings have sensible defaults.
