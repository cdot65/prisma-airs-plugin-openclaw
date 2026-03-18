---
name: prisma-airs-tool-guard
description: "Scan tool inputs through Prisma AIRS using toolEvent content type before execution"
metadata: { "openclaw": { "emoji": "🔒", "events": ["before_tool_call"] } }
---

# Prisma AIRS Tool Guard

Scans tool call inputs through Prisma AIRS using the `toolEvent` content type before execution. Blocks tools when AIRS does not return `action: "allow"`.

## Behavior

Unlike `prisma-airs-tools` (which uses cached scan results), this hook actively scans each tool call's input through the AIRS API. It builds a `toolEvent` with the tool's metadata and arguments, then blocks execution if the scan returns a non-allow verdict.

## Configuration

- `tool_guard_mode`: Scanning mode (default: `deterministic`). Options: `deterministic` / `off`
- `fail_closed`: Block on scan failure (default: true)

## Return Value

- `{ block: true, blockReason: "..." }` — tool call rejected
- `void` — tool call allowed
