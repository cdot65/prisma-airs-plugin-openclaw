---
name: prisma-airs-prompt-scan
description: "Scan full conversation context through Prisma AIRS before prompt assembly"
metadata: { "openclaw": { "emoji": "🔍", "events": ["before_prompt_build"] } }
---

# Prisma AIRS Prompt Scan

Scans the full conversation context (all messages) through Prisma AIRS before the prompt is assembled and sent to the LLM. Catches multi-message injection attacks that per-message scanning misses.

## Behavior

This hook fires after model resolution and before prompt building. It assembles all session messages into a scannable context string, scans through AIRS, and injects security warnings via `prependSystemContext` when threats are detected.

## Configuration

- `prompt_scan_mode`: Scanning mode (default: `deterministic`). Options: `deterministic` / `off`
- `fail_closed`: Inject warning on scan failure (default: true)

## Return Value

- `{ prependSystemContext: "..." }` — security warning injected when threats detected
- `void` — no injection when context is safe
