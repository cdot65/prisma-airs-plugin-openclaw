# Fail Modes Guide

Understanding and configuring fail-open vs fail-closed behavior.

## Overview

When a scan fails (API error, timeout, network issue), the plugin must decide:

| Mode            | On Failure    | Security | Availability |
| --------------- | ------------- | -------- | ------------ |
| **Fail-Closed** | Block request | High     | Lower        |
| **Fail-Open**   | Allow request | Lower    | High         |

## Configuration

```yaml
plugins:
  prisma-airs:
    config:
      fail_closed: true   # default - block on failure
      # or
      fail_closed: false  # allow on failure
```

## Fail-Closed (Default)

### Behavior

When scan fails:

1. Create synthetic "block" result
2. Cache it for downstream hooks
3. Inject warning into agent context
4. Block dangerous tools
5. Block outbound with error message

### Synthetic Result

```json
{
  "action": "block",
  "severity": "CRITICAL",
  "categories": ["scan-failure"],
  "scanId": "",
  "reportId": "",
  "profileName": "default",
  "promptDetected": {
    "injection": false,
    "dlp": false,
    "urlCats": false,
    "toxicContent": false,
    "maliciousCode": false,
    "agent": false,
    "topicViolation": false
  },
  "responseDetected": {
    "dlp": false,
    "urlCats": false,
    "dbSecurity": false,
    "toxicContent": false,
    "maliciousCode": false,
    "agent": false,
    "ungrounded": false,
    "topicViolation": false
  },
  "latencyMs": 0,
  "timeout": false,
  "hasError": true,
  "contentErrors": [],
  "error": "Scan failed: connection timeout"
}
```

### When to Use

- Security-critical applications
- Handling sensitive data
- Compliance requirements
- When attacks during outages are high-risk

### Trade-offs

**Pros**:

- Attacks cannot succeed during outages
- Conservative security posture
- Predictable behavior

**Cons**:

- Service disruption during API issues
- User frustration with failed requests
- Requires monitoring for false blocks

## Fail-Open

### Behavior

When scan fails:

1. Log error
2. No cached result
3. No warning injected
4. No tool blocking
5. Response sent without scanning

### When to Use

- High-availability requirements
- Low-risk applications
- When API reliability is a concern
- Development/testing environments

### Trade-offs

**Pros**:

- Service continues during outages
- Better user experience
- No false positive blocks

**Cons**:

- Attacks can succeed during outages
- Security gap during API issues
- Potential compliance concerns

## Per-Hook Behavior

### prisma-airs-audit (message_received)

```typescript
// Fail-closed
if (config.failClosed) {
  cacheScanResult(sessionKey, {
    action: "block",
    categories: ["scan-failure"],
    error: err.message,
  });
}
// Fail-open: no cache entry
```

### prisma-airs-context (before_agent_start)

```typescript
// Fail-closed
if (config.failClosed) {
  return {
    prependContext: buildWarning({
      action: "block",
      categories: ["scan-failure"],
    }),
  };
}
// Fail-open: return nothing
```

### prisma-airs-outbound (message_sending)

```typescript
// Fail-closed
if (config.failClosed) {
  return {
    content: "Unable to provide response due to security verification issue.",
  };
}
// Fail-open: return nothing (send original)
```

### prisma-airs-tools (before_tool_call)

No direct fail mode—uses cached result from audit hook.

## Monitoring

### Scan Failure Events

```json
{
  "event": "prisma_airs_inbound_scan_error",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "sessionKey": "session_abc123",
  "error": "API error 503: Service temporarily unavailable"
}
```

### Block Due to Failure

```json
{
  "event": "prisma_airs_tool_block",
  "categories": ["scan-failure"],
  "reason": "Scan failed: connection timeout"
}
```

## Hybrid Approaches

### Partial Fail-Closed

Enable fail-closed only for certain hooks:

```yaml
plugins:
  prisma-airs:
    config:
      # Fail-closed for enforcement
      fail_closed: true

      # Disable certain hooks to reduce impact
      context_injection_mode: "off"
      tool_gating_mode: "off"

      # Keep outbound scanning
      outbound_mode: "deterministic"
```

This blocks outbound violations but doesn't block tool calls on scan failure.

### Monitoring Mode

Log failures but don't block:

```yaml
plugins:
  prisma-airs:
    config:
      fail_closed: false
      audit_mode: "deterministic"
      context_injection_mode: "off"
      outbound_mode: "off"
      tool_gating_mode: "off"
```

Review logs to understand failure patterns before enabling enforcement.

## Failure Scenarios

### API Timeout

```
Cause: AIRS API slow to respond (>30s)
fail_closed: true  → Block request
fail_closed: false → Allow request
```

### Network Error

```
Cause: Cannot reach api.aisecurity.paloaltonetworks.com
fail_closed: true  → Block request
fail_closed: false → Allow request
```

### Invalid API Key

```
Cause: API key invalid or expired
Response: 401 Unauthorized
fail_closed: true  → Block request
fail_closed: false → Allow request
```

### Rate Limiting

```
Cause: Too many requests
Response: 429 Too Many Requests
fail_closed: true  → Block request
fail_closed: false → Allow request
```

## Best Practices

### 1. Start with Fail-Closed

Default is fail-closed for good reason. Only change after understanding implications.

### 2. Monitor Failure Rates

Track scan failures:

```bash
grep "scan_error" /var/log/openclaw/*.log | wc -l
```

If failures are frequent, investigate root cause before switching to fail-open.

### 3. Set Up Alerts

Alert on:

- Scan failure rate > 1%
- Consecutive failures > 5
- Error types (timeout, auth, network)

### 4. Have a Fallback Plan

If switching to fail-open:

- Increase other security layers
- Add rate limiting
- Enable additional logging
- Consider secondary scanning service

### 5. Document the Decision

Record why you chose fail-open (if applicable):

- Business justification
- Risk acceptance
- Compensating controls
- Review date
