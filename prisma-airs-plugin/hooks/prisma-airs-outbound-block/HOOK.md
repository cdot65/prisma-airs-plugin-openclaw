---
name: prisma-airs-outbound-block
description: "Block assistant messages that fail Prisma AIRS security scanning at the persistence layer"
metadata: { "openclaw": { "emoji": "🚫", "events": ["before_message_write"] } }
---

# Prisma AIRS Outbound Blocking

Hard guardrail that prevents assistant messages from being persisted unless AIRS returns `action: "allow"`.

## Behavior

This hook fires **before** an assistant message is written to the conversation. It scans assistant responses through Prisma AIRS and blocks any that do not receive an explicit "allow" verdict. Blocked messages are never persisted or shown to the user.

## Configuration

- `outbound_block_mode`: Scanning mode (default: `deterministic`). Options: `deterministic` / `off`
- `fail_closed`: Block on scan failure (default: true)

## Return Value

- `{ block: true }` — message is rejected, never persisted
- `{ block: false }` or `void` — message is allowed through
