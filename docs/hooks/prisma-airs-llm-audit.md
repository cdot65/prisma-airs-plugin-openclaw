# prisma-airs-llm-audit

Audit logging of LLM inputs and outputs through Prisma AIRS scanning.

## Overview

| Property      | Value                                               |
| ------------- | --------------------------------------------------- |
| **Events**    | `llm_input`, `llm_output`                           |
| **Emoji**     | :clipboard:                                         |
| **Can Block** | No (fire-and-forget)                                |
| **Config**    | `llm_audit_mode`                                    |

## Purpose

This hook:

1. Fires on `llm_input` — immediately before the prompt is sent to the LLM
2. Fires on `llm_output` — immediately after the response is received from the LLM
3. Scans the exact LLM I/O through Prisma AIRS
4. Logs structured JSON audit entries with scan results, model info, and token usage
5. Provides the definitive audit record at the LLM boundary

## Why LLM Boundary Auditing Matters

Other hooks scan at the application layer (user messages, tool calls, responses). But the actual content sent to and received from the LLM may differ due to context injection, prompt assembly, and response processing. This hook captures the ground truth of what the model saw and produced.

## Configuration

```yaml
plugins:
  prisma-airs:
    config:
      llm_audit_mode: "deterministic" # default
```

## Audit Log Format

### llm_input

```json
{
  "event": "prisma_airs_llm_input_audit",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "sessionKey": "session-123",
  "runId": "run-1",
  "provider": "anthropic",
  "model": "claude-sonnet-4-20250514",
  "action": "allow",
  "severity": "SAFE",
  "categories": ["safe"],
  "scanId": "scan_abc",
  "latencyMs": 45
}
```

### llm_output

```json
{
  "event": "prisma_airs_llm_output_audit",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "sessionKey": "session-123",
  "runId": "run-1",
  "provider": "anthropic",
  "model": "claude-sonnet-4-20250514",
  "action": "allow",
  "severity": "SAFE",
  "categories": ["safe"],
  "scanId": "scan_def",
  "latencyMs": 38,
  "usage": { "input": 500, "output": 200, "total": 700 }
}
```

## Related Hooks

- [prisma-airs-audit](prisma-airs-audit.md) — Application-layer message audit
- [prisma-airs-prompt-scan](prisma-airs-prompt-scan.md) — Full context scanning before prompt build
- [prisma-airs-outbound](prisma-airs-outbound.md) — Response blocking/masking
