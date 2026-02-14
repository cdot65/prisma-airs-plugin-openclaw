# prisma-airs-audit

Audit logging hook for all inbound messages with scan caching.

## Overview

| Property      | Value                          |
| ------------- | ------------------------------ |
| **Event**     | `message_received`             |
| **Emoji**     | :clipboard:                    |
| **Can Block** | No                             |
| **Config**    | `audit_enabled`, `fail_closed` |

## Purpose

This hook:

1. Scans every inbound message using Prisma AIRS
2. Caches results for downstream hooks (`before_agent_start`, `before_tool_call`)
3. Logs scan results for audit compliance

## Configuration

```yaml
plugins:
  prisma-airs:
    audit_enabled: true # default
    fail_closed: true # Block on scan failure (default)
    profile_name: "default"
    app_name: "openclaw"
```

## Audit Log Format

```json
{
  "event": "prisma_airs_inbound_scan",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "sessionKey": "session_abc123",
  "senderId": "user@example.com",
  "senderName": "John Doe",
  "channel": "slack",
  "provider": "slack",
  "messageId": "msg_xyz789",
  "action": "block",
  "severity": "HIGH",
  "categories": ["prompt_injection"],
  "scanId": "scan_abc123",
  "reportId": "report_xyz789",
  "latencyMs": 145,
  "promptDetected": {
    "injection": true,
    "dlp": false,
    "urlCats": false,
    "toxicContent": false,
    "maliciousCode": false,
    "agent": false,
    "topicViolation": false
  }
}
```

## Event Shape

```typescript
interface MessageReceivedEvent {
  from: string;
  content: string;
  timestamp?: number;
  metadata?: {
    to?: string;
    provider?: string;
    surface?: string;
    threadId?: string;
    originatingChannel?: string;
    originatingTo?: string;
    messageId?: string;
    senderId?: string;
    senderName?: string;
    senderUsername?: string;
    senderE164?: string;
  };
}
```

## Handler Logic

```typescript
const handler = async (event, ctx) => {
  const config = getPluginConfig(ctx);
  if (!config.enabled) return;

  const sessionKey = ctx.conversationId || `${event.from}_${ctx.channelId}`;

  try {
    const result = await scan({
      prompt: event.content,
      profileName: config.profileName,
      appName: config.appName,
      apiKey: config.apiKey,
      appUser: event.metadata?.senderId,
    });

    // Cache for downstream hooks
    const msgHash = hashMessage(event.content);
    cacheScanResult(sessionKey, result, msgHash);

    // Audit log
    console.log(JSON.stringify({ event: "prisma_airs_inbound_scan", ... }));

  } catch (err) {
    // If fail-closed, cache synthetic "block" result
    if (config.failClosed) {
      cacheScanResult(sessionKey, {
        action: "block",
        severity: "CRITICAL",
        categories: ["scan-failure"],
        error: err.message,
      });
    }
  }
};
```

## Limitations

!!! warning "Fire-and-Forget"
`message_received` is async and cannot block messages. This hook only logs and caches—it relies on downstream hooks for enforcement.

## Cache Details

| Property | Value                                    |
| -------- | ---------------------------------------- |
| **TTL**  | 30 seconds                               |
| **Key**  | Session ID or `${sender}_${channel}`     |
| **Hash** | Message content hash for stale detection |

## Fail-Closed Behavior

When `fail_closed: true` (default) and scan fails:

1. Error is logged
2. Synthetic "block" result cached:
   ```json
   {
     "action": "block",
     "severity": "CRITICAL",
     "categories": ["scan-failure"],
     "error": "Scan failed: connection timeout"
   }
   ```
3. Downstream hooks will see this as a threat

## Related Hooks

- [prisma-airs-context](prisma-airs-context.md) - Uses cached results for warning injection
- [prisma-airs-tools](prisma-airs-tools.md) - Uses cached results for tool blocking
