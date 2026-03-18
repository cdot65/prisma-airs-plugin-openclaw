---
name: prisma-airs-llm-audit
description: "Audit log LLM inputs and outputs through Prisma AIRS scanning"
metadata: { "openclaw": { "emoji": "📋", "events": ["llm_input", "llm_output"] } }
---

# Prisma AIRS LLM Audit

Scans the exact prompts sent to and responses received from the LLM through Prisma AIRS. Provides a complete audit trail at the LLM boundary.

## Behavior

This hook handles both `llm_input` and `llm_output` events. On input, it scans the assembled prompt (including system prompt). On output, it scans the concatenated assistant response texts. Results are logged as structured JSON audit entries.

## Configuration

- `llm_audit_mode`: Audit mode (default: `deterministic`). Options: `deterministic` / `off`

## Return Value

Fire-and-forget — returns void. Cannot block LLM calls.
