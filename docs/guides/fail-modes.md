# Fail Modes Guide

Understanding fail-closed vs fail-open behavior and the interaction with scanning modes.

## Overview

When an AIRS scan fails (API error, timeout, network issue), the plugin must decide whether to block or allow:

| Mode | On Failure | Security | Availability |
|------|------------|----------|--------------|
| **Fail-Closed** (`fail_closed: true`) | Block request | High | Lower |
| **Fail-Open** (`fail_closed: false`) | Allow request | Lower | High |

Default is **fail-closed** (`true`).

## Which Hooks Support fail_closed

| Hook | Event | Fail-Closed Behavior |
|------|-------|---------------------|
| `prisma-airs-inbound-block` | `before_message_write` | Returns `{ block: true }` |
| `prisma-airs-outbound-block` | `before_message_write` | Returns `{ block: true }` |
| `prisma-airs-context` | `before_agent_start` | Caches synthetic block result, injects warning |
| `prisma-airs-outbound` | `message_sending` | Returns replacement content with error message |
| `prisma-airs-tool-guard` | `before_tool_call` | Returns `{ block: true, blockReason }` |
| `prisma-airs-audit` | `message_received` | Caches synthetic block result for downstream hooks |
| `prisma-airs-tools` | `before_tool_call` | No direct fail mode -- uses cached result from audit |

!!! note "Hooks without fail_closed"
    `prisma-airs-guard` (reminder injection), `prisma-airs-tool-redact` (regex-only, no API call), `prisma-airs-llm-audit`, and `prisma-airs-tool-audit` (fire-and-forget) do not use `fail_closed`.

## Synthetic Block Result

When `fail_closed` is true and a scan fails, the context handler creates and caches this synthetic result:

```json
{
  "action": "block",
  "severity": "CRITICAL",
  "categories": ["scan-failure"],
  "scanId": "",
  "reportId": "",
  "profileName": "default",
  "promptDetected": {
    "injection": false, "dlp": false, "urlCats": false,
    "toxicContent": false, "maliciousCode": false,
    "agent": false, "topicViolation": false
  },
  "responseDetected": {
    "dlp": false, "urlCats": false, "dbSecurity": false,
    "toxicContent": false, "maliciousCode": false,
    "agent": false, "ungrounded": false, "topicViolation": false
  },
  "latencyMs": 0,
  "timeout": false,
  "hasError": true,
  "contentErrors": [],
  "error": "Scan failed: <error message>"
}
```

This cached result propagates to downstream hooks:

- **Tools hook**: sees `scan-failure` category, blocks `SENSITIVE_TOOLS` + write/edit tools
- **Context hook**: injects "Security scan failed. Treat with extreme caution."
- **Outbound hook**: if it also fails, returns generic error message

## fail_closed + probabilistic Constraint

`resolveAllModes()` in `src/config.ts` rejects `fail_closed: true` combined with any probabilistic mode:

```
fail_closed=true is incompatible with probabilistic mode.
Set fail_closed=false or change these to deterministic/off: audit_mode, outbound_mode
```

This applies to: `audit_mode`, `context_injection_mode`, `outbound_mode`, `tool_gating_mode`.

Rationale: probabilistic mode lets the model decide whether to scan. If the model skips scanning during an outage, fail-closed cannot engage because no scan was attempted.

## Fail-Closed Behavior by Hook

### prisma-airs-inbound-block

```typescript
// On scan exception:
if (config.failClosed) {
  return { block: true };
}
return; // fail-open
```

User message is never persisted to conversation history.

### prisma-airs-outbound-block

Same pattern as inbound-block but for assistant messages.

### prisma-airs-context

```typescript
// On scan exception:
if (config.failClosed) {
  scanResult = {
    action: "block",
    severity: "CRITICAL",
    categories: ["scan-failure"],
    // ... all detection flags false
    hasError: true,
    error: `Scan failed: ${err.message}`,
  };
  cacheScanResult(sessionKey, scanResult, msgHash);
} else {
  return; // fail-open, no warning
}
```

### prisma-airs-outbound

```typescript
// On scan exception:
if (config.failClosed) {
  return {
    content: "I apologize, but I'm unable to provide a response at this time due to a security verification issue. Please try again.",
  };
}
return; // fail-open, send original
```

### prisma-airs-tool-guard

```typescript
// On scan exception:
if (config.failClosed) {
  return {
    block: true,
    blockReason: `Tool '${event.toolName}' blocked: security scan failed. Try again later.`,
  };
}
return; // fail-open
```

## Configuration Examples

### Default (Fail-Closed)

```json
{
  "fail_closed": true
}
```

All scanning hooks block on failure. Maximum security.

### Fail-Open

```json
{
  "fail_closed": false
}
```

All scanning hooks allow on failure. Maximum availability.

### Audit-Only with Fail-Open

Log everything but block nothing, even on failure:

```json
{
  "fail_closed": false,
  "audit_mode": "deterministic",
  "context_injection_mode": "off",
  "outbound_mode": "off",
  "tool_gating_mode": "off",
  "inbound_block_mode": "off",
  "outbound_block_mode": "off",
  "tool_guard_mode": "off"
}
```

### Selective Enforcement

Keep outbound blocking but disable tool gating on failure:

```json
{
  "fail_closed": true,
  "tool_gating_mode": "off",
  "outbound_mode": "deterministic"
}
```

## Source Files

- Config validation: `prisma-airs-plugin/src/config.ts`
- Context fail-closed: `prisma-airs-plugin/hooks/prisma-airs-context/handler.ts`
- Outbound fail-closed: `prisma-airs-plugin/hooks/prisma-airs-outbound/handler.ts`
- Inbound block fail-closed: `prisma-airs-plugin/hooks/prisma-airs-inbound-block/handler.ts`
- Tool guard fail-closed: `prisma-airs-plugin/hooks/prisma-airs-tool-guard/handler.ts`
