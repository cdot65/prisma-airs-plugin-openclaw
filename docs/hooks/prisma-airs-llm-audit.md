# prisma-airs-llm-audit

Fire-and-forget audit logging of exact LLM input and output through AIRS.

## Overview

| Field | Value |
|-------|-------|
| Event | `llm_input`, `llm_output` |
| Config field | `llm_audit_mode` |
| Can Block | No |
| Default mode | `deterministic` |
| Valid modes | `deterministic`, `probabilistic`, `off` |

## Purpose

Provides a definitive audit trail at the LLM boundary by scanning the exact prompts sent to and responses received from the model. This captures content that may differ from the original user message due to prompt assembly, context injection, or tool results.

## How It Works

The handler dispatches based on `event.hookEvent`:

### llm_input

1. Reads `llm_audit_mode` from config (default: `deterministic`). Returns void if `off`.
2. Builds scan content by concatenating:
   - `[system]: <systemPrompt>` (if present)
   - `event.prompt`
3. Skips if content is empty after trimming.
4. Calls `scan({ prompt: content, profileName, appName })`.
5. Logs structured JSON to stdout with: runId, provider, model, action, severity, categories, scanId, reportId, latencyMs, promptDetected.

### llm_output

1. Same mode check as above.
2. Concatenates `event.assistantTexts` with newlines.
3. Skips if content is empty after trimming.
4. Calls `scan({ response: content, profileName, appName })`.
5. Logs structured JSON to stdout with: runId, provider, model, action, severity, categories, scanId, reportId, latencyMs, responseDetected, usage.

### Error Handling

On scan failure for either event type:

- Logs error to stderr.
- Returns void (fire-and-forget, no blocking).
- No fail-closed behavior -- errors are silently logged.

## Configuration

```yaml
plugins:
  entries:
    prisma-airs:
      config:
        llm_audit_mode: "deterministic"  # "deterministic" | "probabilistic" | "off"
        profile_name: "default"
        app_name: "openclaw"
```

## Behavior

| Condition | Result |
|-----------|--------|
| `llm_audit_mode` = `off` | No-op |
| `hookEvent` = `llm_input` with empty prompt | No-op |
| `hookEvent` = `llm_input` with content | Scan as prompt, log result |
| `hookEvent` = `llm_output` with empty texts | No-op |
| `hookEvent` = `llm_output` with content | Scan as response, log result |
| Scan fails | Log error, no-op |

## Related Hooks

- [prisma-airs-audit](prisma-airs-audit.md) -- Scans inbound user messages (pre-processing). This hook scans at the LLM boundary (post-processing).
- [prisma-airs-tool-audit](prisma-airs-tool-audit.md) -- Companion audit hook for tool outputs.
