---
name: prisma-airs-tools
description: "Block dangerous tool calls when security threats are detected"
metadata: { "openclaw": { "emoji": "🛑", "events": ["before_tool_call"] } }
---

# Prisma AIRS Tool Gating

Blocks dangerous tool calls when security warnings are active from inbound scanning.

## Behavior

This hook runs before each tool call and checks if the current session has an active security warning (from `message_received` or `before_agent_start` scanning). Based on the detected threat categories, it blocks specific tools that could be dangerous.

## Tool Blocking Matrix

| Threat Category                 | Blocked Tools                 |
| ------------------------------- | ----------------------------- |
| `agent-threat`                  | ALL external tools            |
| `sql-injection` / `db-security` | exec, database, query, sql    |
| `malicious-code`                | exec, write, edit, eval, bash |
| `prompt-injection`              | exec, gateway, message, cron  |
| `malicious-url`                 | web_fetch, browser, curl      |

## High-Risk Tools (Default)

These tools are blocked on ANY detected threat:

- `exec` - Command execution
- `Bash` - Shell access
- `write` - File writing
- `edit` - File editing
- `gateway` - Gateway operations
- `message` - Sending messages
- `cron` - Scheduled tasks

## Configuration

- `tool_gating_mode`: Scanning mode (default: `deterministic`). Options: `deterministic` / `probabilistic` / `off`
- `high_risk_tools`: List of tools to block on any threat
