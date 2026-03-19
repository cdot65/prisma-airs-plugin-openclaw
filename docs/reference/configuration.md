# Configuration Reference

Complete reference for all configuration fields in the Prisma AIRS plugin. All fields are defined in the `configSchema` of `openclaw.plugin.json`.

## Configuration Fields

| Field | Type | Default | Valid Values | Description |
|-------|------|---------|--------------|-------------|
| `api_key` | `string` | _(none)_ | Any string | Prisma AIRS API key from Strata Cloud Manager |
| `profile_name` | `string` | `"default"` | Any string | AIRS security profile name from Strata Cloud Manager |
| `app_name` | `string` | `"openclaw"` | Any string | Application name sent in scan metadata |
| `reminder_mode` | `string` | `"on"` | `"on"`, `"off"` | Inject security scanning reminder on agent bootstrap |
| `audit_mode` | `string` | `"deterministic"` | `"deterministic"`, `"probabilistic"`, `"off"` | Audit logging mode for inbound messages |
| `context_injection_mode` | `string` | `"deterministic"` | `"deterministic"`, `"probabilistic"`, `"off"` | Context injection of threat warnings on agent start |
| `outbound_mode` | `string` | `"deterministic"` | `"deterministic"`, `"probabilistic"`, `"off"` | Outbound response scanning, blocking, and DLP masking |
| `tool_gating_mode` | `string` | `"deterministic"` | `"deterministic"`, `"probabilistic"`, `"off"` | Cache-based tool gating using prior scan results |
| `inbound_block_mode` | `string` | `"deterministic"` | `"deterministic"`, `"off"` | Hard inbound blocking of user messages unless AIRS returns allow |
| `outbound_block_mode` | `string` | `"deterministic"` | `"deterministic"`, `"off"` | Hard outbound blocking of assistant messages at persistence layer |
| `tool_guard_mode` | `string` | `"deterministic"` | `"deterministic"`, `"off"` | Active AIRS scanning of tool inputs before execution |
| `prompt_scan_mode` | `string` | `"deterministic"` | `"deterministic"`, `"off"` | Full conversation context scanning before prompt assembly |
| `tool_redact_mode` | `string` | `"deterministic"` | `"deterministic"`, `"off"` | Regex-based PII/credential redaction from tool outputs |
| `llm_audit_mode` | `string` | `"deterministic"` | `"deterministic"`, `"off"` | Audit logging of LLM inputs and outputs through AIRS |
| `tool_audit_mode` | `string` | `"deterministic"` | `"deterministic"`, `"off"` | Audit logging of tool outputs through AIRS after execution |
| `fail_closed` | `boolean` | `true` | `true`, `false` | Block messages when AIRS scan fails |
| `dlp_mask_only` | `boolean` | `true` | `true`, `false` | Mask DLP violations instead of blocking when no other violations |
| `high_risk_tools` | `string[]` | See below | Array of tool names | Tools blocked on any detected threat |

### Default `high_risk_tools`

```json
["exec", "Bash", "bash", "write", "Write", "edit", "Edit", "gateway", "message", "cron"]
```

## Mode Types

### Reminder Mode

| Value | Behavior |
|-------|----------|
| `"on"` | Inject security scanning reminder into agent context at bootstrap |
| `"off"` | Skip reminder injection |

### Feature Mode (tri-state)

Used by `audit_mode`, `context_injection_mode`, `outbound_mode`, and `tool_gating_mode`.

| Value | Behavior |
|-------|----------|
| `"deterministic"` | Hook-based, always executes on every event |
| `"probabilistic"` | Tool-based, model decides when to invoke |
| `"off"` | Disabled |

### Binary Mode

Used by `inbound_block_mode`, `outbound_block_mode`, `tool_guard_mode`, `prompt_scan_mode`, `tool_redact_mode`, `llm_audit_mode`, and `tool_audit_mode`.

| Value | Behavior |
|-------|----------|
| `"deterministic"` | Hook-based, always executes |
| `"off"` | Disabled |

## Constraints

!!! warning "fail_closed + probabilistic"
    When `fail_closed` is `true`, any feature set to `"probabilistic"` causes a startup error. The `resolveAllModes()` function in `src/config.ts` throws:

    ```
    fail_closed=true is incompatible with probabilistic mode.
    Set fail_closed=false or change these to deterministic/off: <field_names>
    ```

    This validation applies to `audit_mode`, `context_injection_mode`, `outbound_mode`, and `tool_gating_mode`.

## Example Configuration

```json
{
  "plugins": {
    "entries": {
      "prisma-airs": {
        "enabled": true,
        "config": {
          "api_key": "your-api-key-here",
          "profile_name": "default",
          "app_name": "openclaw",
          "reminder_mode": "on",
          "audit_mode": "deterministic",
          "context_injection_mode": "deterministic",
          "outbound_mode": "deterministic",
          "tool_gating_mode": "deterministic",
          "inbound_block_mode": "deterministic",
          "outbound_block_mode": "deterministic",
          "tool_guard_mode": "deterministic",
          "prompt_scan_mode": "deterministic",
          "tool_redact_mode": "deterministic",
          "llm_audit_mode": "deterministic",
          "tool_audit_mode": "deterministic",
          "fail_closed": true,
          "dlp_mask_only": true,
          "high_risk_tools": ["exec", "Bash", "bash", "write", "Write", "edit", "Edit", "gateway", "message", "cron"]
        }
      }
    }
  }
}
```

## Minimal Configuration

Only `api_key` is required. All other fields use their defaults:

```json
{
  "plugins": {
    "entries": {
      "prisma-airs": {
        "enabled": true,
        "config": {
          "api_key": "your-api-key-here"
        }
      }
    }
  }
}
```

## Audit-Only Mode

Scan and log every message but disable all enforcement:

```json
{
  "plugins": {
    "entries": {
      "prisma-airs": {
        "config": {
          "api_key": "your-key",
          "audit_mode": "deterministic",
          "context_injection_mode": "off",
          "outbound_mode": "off",
          "tool_gating_mode": "off",
          "inbound_block_mode": "off",
          "outbound_block_mode": "off",
          "tool_guard_mode": "off",
          "prompt_scan_mode": "off",
          "tool_redact_mode": "off",
          "llm_audit_mode": "off",
          "tool_audit_mode": "off",
          "fail_closed": false
        }
      }
    }
  }
}
```

## Maximum Enforcement

All hooks active, DLP blocks instead of masking, expanded tool list:

```json
{
  "plugins": {
    "entries": {
      "prisma-airs": {
        "config": {
          "api_key": "your-key",
          "fail_closed": true,
          "dlp_mask_only": false,
          "high_risk_tools": [
            "exec", "Bash", "bash", "write", "Write", "edit", "Edit",
            "gateway", "message", "cron", "browser", "WebFetch",
            "eval", "NotebookEdit"
          ]
        }
      }
    }
  }
}
```

## Source Files

- Config schema: `prisma-airs-plugin/openclaw.plugin.json`
- Config resolution: `prisma-airs-plugin/src/config.ts`
