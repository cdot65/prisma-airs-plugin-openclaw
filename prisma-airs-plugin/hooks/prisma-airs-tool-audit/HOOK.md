---
name: prisma-airs-tool-audit
description: "Audit log tool execution results through Prisma AIRS scanning"
metadata: { "openclaw": { "emoji": "🔎", "events": ["after_tool_call"] } }
---

# Prisma AIRS Tool Audit

Scans tool execution results through Prisma AIRS after tool completion. Provides audit trail of tool output threats.

## Behavior

This hook fires after a tool completes execution. It serializes the tool result, scans it through AIRS using toolEvent content type, and logs structured audit entries. Complements tool-guard (pre-execution) by scanning what tools actually returned.

## Configuration

- `tool_audit_mode`: Audit mode (default: `deterministic`). Options: `deterministic` / `off`

## Return Value

Fire-and-forget — returns void. Cannot block tool results.
