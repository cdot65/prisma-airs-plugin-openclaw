# Configuration

## Where to Configure What

| What to Configure                                                | Where                |
| ---------------------------------------------------------------- | -------------------- |
| **Detection rules** (prompt injection, DLP, URL filtering, etc.) | Strata Cloud Manager |
| **Actions** (allow/alert/block per detection)                    | Strata Cloud Manager |
| **DLP patterns** (SSN, credit cards, API keys)                   | Strata Cloud Manager |
| **URL categories** (malware, phishing, adult)                    | Strata Cloud Manager |
| **Custom topics** (organization policies)                        | Strata Cloud Manager |
| **API key, profile, app name**                                   | Plugin config        |
| **Hook modes** (deterministic/probabilistic/off)                 | Plugin config        |
| **Local enforcement** (fail_closed, DLP masking, high-risk tools)| Plugin config        |

!!! warning "All Guardrails Are in SCM"
    This plugin does NOT configure AI guardrails. All detection services, sensitivity levels, and actions are configured in your **Strata Cloud Manager** tenant. The plugin points to your SCM security profile and applies local enforcement.

## Full Configuration Reference

All 16 config fields from `openclaw.plugin.json` `configSchema`:

```yaml
plugins:
  prisma-airs:
    enabled: true
    config:
      # ── Connection ──────────────────────────────────────────────
      # Prisma AIRS API key from Strata Cloud Manager (required)
      api_key: "your-api-key-here"

      # AIRS security profile from Strata Cloud Manager
      profile_name: "default"

      # Application name for scan metadata and audit logs
      app_name: "openclaw"

      # ── Blocking Hooks ──────────────────────────────────────────
      # Block user messages unless AIRS returns allow (deterministic | off)
      inbound_block_mode: "deterministic"

      # Block assistant messages at persistence layer (deterministic | off)
      outbound_block_mode: "deterministic"

      # Scan outbound responses — block or mask (deterministic | probabilistic | off)
      outbound_mode: "deterministic"

      # Scan tool inputs through AIRS before execution (deterministic | off)
      tool_guard_mode: "deterministic"

      # Gate tool calls using cached scan results (deterministic | probabilistic | off)
      tool_gating_mode: "deterministic"

      # ── Scanning Hooks ─────────────────────────────────────────
      # Scan full conversation context before prompt assembly (deterministic | off)
      prompt_scan_mode: "deterministic"

      # Redact PII/credentials from tool outputs (deterministic | off)
      tool_redact_mode: "deterministic"

      # Inject threat warnings into agent context on startup (deterministic | probabilistic | off)
      context_injection_mode: "deterministic"

      # Inject security scanning reminder on agent bootstrap (on | off)
      reminder_mode: "on"

      # ── Audit Hooks ────────────────────────────────────────────
      # Scan inbound messages for audit logging (deterministic | probabilistic | off)
      audit_mode: "deterministic"

      # Scan LLM inputs/outputs through AIRS (deterministic | off)
      llm_audit_mode: "deterministic"

      # Scan tool outputs through AIRS after execution (deterministic | off)
      tool_audit_mode: "deterministic"

      # ── Advanced Settings ──────────────────────────────────────
      # Block messages when AIRS scan fails (default: true)
      fail_closed: true

      # Mask DLP violations instead of blocking when DLP is the only violation
      dlp_mask_only: true

      # Tools to block on any detected threat
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

## Config Fields Reference

### Connection

| Field          | Type     | Default      | Description                                    |
| -------------- | -------- | ------------ | ---------------------------------------------- |
| `api_key`      | `string` | —            | Prisma AIRS API key from Strata Cloud Manager  |
| `profile_name` | `string` | `"default"`  | AIRS security profile name from SCM            |
| `app_name`     | `string` | `"openclaw"` | Application name for scan metadata             |

### Blocking Hooks

| Field                | Type     | Allowed Values                          | Default           | Hook                       |
| -------------------- | -------- | --------------------------------------- | ----------------- | -------------------------- |
| `inbound_block_mode` | `string` | `deterministic`, `off`                  | `deterministic`   | `prisma-airs-inbound-block`  |
| `outbound_block_mode`| `string` | `deterministic`, `off`                  | `deterministic`   | `prisma-airs-outbound-block` |
| `outbound_mode`      | `string` | `deterministic`, `probabilistic`, `off` | `deterministic`   | `prisma-airs-outbound`       |
| `tool_guard_mode`    | `string` | `deterministic`, `off`                  | `deterministic`   | `prisma-airs-tool-guard`     |
| `tool_gating_mode`   | `string` | `deterministic`, `probabilistic`, `off` | `deterministic`   | `prisma-airs-tools`          |

### Scanning Hooks

| Field                    | Type     | Allowed Values                          | Default           | Hook                      |
| ------------------------ | -------- | --------------------------------------- | ----------------- | ------------------------- |
| `prompt_scan_mode`       | `string` | `deterministic`, `off`                  | `deterministic`   | `prisma-airs-prompt-scan`   |
| `tool_redact_mode`       | `string` | `deterministic`, `off`                  | `deterministic`   | `prisma-airs-tool-redact`   |
| `context_injection_mode` | `string` | `deterministic`, `probabilistic`, `off` | `deterministic`   | `prisma-airs-context`       |
| `reminder_mode`          | `string` | `on`, `off`                             | `on`              | `prisma-airs-guard`         |

### Audit Hooks

| Field             | Type     | Allowed Values                          | Default           | Hook                      |
| ----------------- | -------- | --------------------------------------- | ----------------- | ------------------------- |
| `audit_mode`      | `string` | `deterministic`, `probabilistic`, `off` | `deterministic`   | `prisma-airs-audit`         |
| `llm_audit_mode`  | `string` | `deterministic`, `off`                  | `deterministic`   | `prisma-airs-llm-audit`     |
| `tool_audit_mode` | `string` | `deterministic`, `off`                  | `deterministic`   | `prisma-airs-tool-audit`    |

### Advanced Settings

| Field             | Type       | Default      | Description                                         |
| ----------------- | ---------- | ------------ | --------------------------------------------------- |
| `fail_closed`     | `boolean`  | `true`       | Block messages when AIRS scan fails                  |
| `dlp_mask_only`   | `boolean`  | `true`       | Mask DLP violations instead of blocking              |
| `high_risk_tools` | `string[]` | see below    | Tools to block on any detected threat                |

Default `high_risk_tools`:

```yaml
["exec", "Bash", "bash", "write", "Write", "edit", "Edit", "gateway", "message", "cron"]
```

## Scanning Modes Explained

### `deterministic`

The hook fires on every matching event. No model discretion — guaranteed enforcement.

### `probabilistic`

The hook is disabled. Instead, a tool is registered that the model can call when it deems appropriate. Available for `audit_mode`, `context_injection_mode`, `outbound_mode`, and `tool_gating_mode`.

!!! note "Probabilistic Tools"
    When a mode is set to `probabilistic`, the plugin registers an agent tool instead of a hook:

    - `audit_mode` / `context_injection_mode` → `prisma_airs_scan_prompt`
    - `outbound_mode` → `prisma_airs_scan_response`
    - `tool_gating_mode` → `prisma_airs_check_tool_safety`

### `off`

The hook is completely disabled. No scanning, no tool registration.

!!! warning "fail_closed + probabilistic"
    Setting `fail_closed: true` with any `probabilistic` mode will throw a startup error. Either set `fail_closed: false` or change the mode to `deterministic` or `off`.

## Preset Configurations

### Maximum Security

All hooks enabled, fail closed, deterministic enforcement everywhere:

```yaml
plugins:
  prisma-airs:
    config:
      api_key: "your-api-key"
      profile_name: "strict"
      reminder_mode: "on"
      audit_mode: "deterministic"
      context_injection_mode: "deterministic"
      outbound_mode: "deterministic"
      tool_gating_mode: "deterministic"
      inbound_block_mode: "deterministic"
      outbound_block_mode: "deterministic"
      tool_guard_mode: "deterministic"
      prompt_scan_mode: "deterministic"
      tool_redact_mode: "deterministic"
      llm_audit_mode: "deterministic"
      tool_audit_mode: "deterministic"
      fail_closed: true
      dlp_mask_only: false
```

!!! tip "This Is the Default"
    Maximum security is the default configuration (except `dlp_mask_only` defaults to `true`). You only need to set `api_key` — everything else is already `deterministic` / `on` / `true`.

### Audit Only

Observe and log without blocking anything:

```yaml
plugins:
  prisma-airs:
    config:
      api_key: "your-api-key"
      reminder_mode: "on"
      audit_mode: "deterministic"
      llm_audit_mode: "deterministic"
      tool_audit_mode: "deterministic"
      context_injection_mode: "deterministic"
      outbound_mode: "off"
      tool_gating_mode: "off"
      inbound_block_mode: "off"
      outbound_block_mode: "off"
      tool_guard_mode: "off"
      prompt_scan_mode: "off"
      tool_redact_mode: "off"
      fail_closed: false
```

### Blocking Only

Hard guardrails without audit overhead:

```yaml
plugins:
  prisma-airs:
    config:
      api_key: "your-api-key"
      reminder_mode: "off"
      audit_mode: "off"
      llm_audit_mode: "off"
      tool_audit_mode: "off"
      context_injection_mode: "off"
      outbound_mode: "deterministic"
      tool_gating_mode: "deterministic"
      inbound_block_mode: "deterministic"
      outbound_block_mode: "deterministic"
      tool_guard_mode: "deterministic"
      prompt_scan_mode: "deterministic"
      tool_redact_mode: "deterministic"
      fail_closed: true
      dlp_mask_only: true
```

## Strata Cloud Manager Setup

All detection configuration happens in SCM.

### 1. Get API Key

1. Log into [Strata Cloud Manager](https://stratacloudmanager.paloaltonetworks.com)
2. Navigate to **Settings** > **API Keys**
3. Create a new key with AIRS permissions
4. Copy the key to the plugin's `api_key` config field

### 2. Create Security Profile

1. Navigate to **AI Runtime Security** > **Security Profiles**
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

```yaml
plugins:
  prisma-airs:
    config:
      api_key: "your-key"
```

All other fields have sensible defaults — every hook enabled, deterministic mode, fail closed.
