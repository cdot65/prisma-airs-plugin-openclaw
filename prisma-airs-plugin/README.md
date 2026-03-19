# @cdot65/prisma-airs

OpenClaw plugin for [Prisma AIRS](https://www.paloaltonetworks.com/prisma/ai-runtime-security) (AI Runtime Security) from Palo Alto Networks. Defense-in-depth with 12 security hooks across 9 event types.

## Features

- **12 security hooks** — blocking, scanning, and audit logging at every agent lifecycle stage
- **Per-hook configuration** — enable/disable each hook independently (`deterministic` / `off`)
- **DLP masking** — redact SSNs, credit cards, emails, API keys instead of blocking
- **Tool gating** — block dangerous tools (Bash, Write, Edit) during active threats
- **Fail-closed** — block on scan failure by default
- **Probabilistic mode** — let the model decide when to scan (for audit, context, outbound, tool gating)
- **Gateway RPC**: `prisma-airs.scan`, `prisma-airs.status`
- **CLI**: `openclaw prisma-airs`, `openclaw prisma-airs-scan`

## Hooks

| Hook                       | Event                      | Can Block |
| -------------------------- | -------------------------- | --------- |
| prisma-airs-inbound-block  | `before_message_write`     | Yes       |
| prisma-airs-outbound-block | `before_message_write`     | Yes       |
| prisma-airs-outbound       | `message_sending`          | Yes       |
| prisma-airs-tool-guard     | `before_tool_call`         | Yes       |
| prisma-airs-tools          | `before_tool_call`         | Yes       |
| prisma-airs-prompt-scan    | `before_prompt_build`      | No        |
| prisma-airs-tool-redact    | `tool_result_persist`      | No        |
| prisma-airs-context        | `before_agent_start`       | No        |
| prisma-airs-guard          | `before_agent_start`       | No        |
| prisma-airs-audit          | `message_received`         | No        |
| prisma-airs-llm-audit      | `llm_input` / `llm_output` | No        |
| prisma-airs-tool-audit     | `after_tool_call`          | No        |

## Installation

```bash
openclaw plugins install @cdot65/prisma-airs
```

## Configuration

```json
{
  "plugins": {
    "entries": {
      "prisma-airs": {
        "config": {
          "api_key": "your-key",
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
          "high_risk_tools": [
            "exec",
            "Bash",
            "bash",
            "write",
            "Write",
            "edit",
            "Edit",
            "gateway",
            "message",
            "cron"
          ]
        }
      }
    }
  }
}
```

## Usage

```bash
# Check status
openclaw prisma-airs

# Scan text
openclaw prisma-airs-scan "message to scan"
openclaw prisma-airs-scan --json "message"
```

## Requirements

- Node.js 18+
- OpenClaw v2026.2.1+
- Prisma AIRS API key from [Strata Cloud Manager](https://docs.paloaltonetworks.com/ai-runtime-security)

## Documentation

Full docs at [cdot65.github.io/prisma-airs-plugin-openclaw](https://cdot65.github.io/prisma-airs-plugin-openclaw/)

## License

MIT
