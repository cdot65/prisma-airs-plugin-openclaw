---
name: prisma-airs-inbound-block
description: "Block inbound user messages that fail Prisma AIRS security scanning"
metadata: { "openclaw": { "emoji": "🚫", "events": ["before_message_write"] } }
---

# Prisma AIRS Inbound Blocking

Hard guardrail that prevents user messages from being persisted unless AIRS returns `action: "allow"`.

## Behavior

This hook fires **before** a message is written to the conversation. It scans user messages through Prisma AIRS and blocks any that do not receive an explicit "allow" verdict. Blocked messages never reach the AI model.

## Configuration

- `inbound_block_mode`: Scanning mode (default: `deterministic`). Options: `deterministic` / `off`
- `fail_closed`: Block on scan failure (default: true)

## Return Value

- `{ block: true }` — message is rejected, never persisted
- `{ block: false }` or `void` — message is allowed through
