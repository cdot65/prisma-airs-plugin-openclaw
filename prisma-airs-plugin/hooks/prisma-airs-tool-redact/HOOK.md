---
name: prisma-airs-tool-redact
description: "Redact sensitive data from tool outputs before session persistence"
metadata: { "openclaw": { "emoji": "🔒", "events": ["tool_result_persist"] } }
---

# Prisma AIRS Tool Redact

Applies DLP regex masking to tool result content before it is written to the session JSONL transcript. Prevents PII, credentials, and secrets from being persisted in conversation history.

## Behavior

This hook fires synchronously before tool results are persisted. It applies regex-based pattern matching to detect and redact sensitive data (SSNs, credit cards, emails, API keys, AWS keys, phone numbers, private IPs). Optionally checks the scan cache for AIRS DLP signals from the tool-guard hook.

## Configuration

- `tool_redact_mode`: Redaction mode (default: `deterministic`). Options: `deterministic` / `off`

## Return Value

- `{ message: { ...modified } }` — redacted message when sensitive data found
- `void` — no modification when content is clean
