# Hook Lifecycle

## OpenClaw Hook System

OpenClaw provides several hook points for plugins to intercept and modify behavior. The Prisma AIRS plugin uses 5 hooks for defense-in-depth.

## Hook Types

### Void Hooks (Fire-and-Forget)

Void hooks execute asynchronously. Their return values are ignored, and they cannot block or modify the event.

```javascript
// OpenClaw extensionAPI.js (simplified)
async runVoidHook(hookName, event) {
  const handlers = this.hooks.get(hookName);
  for (const handler of handlers) {
    handler(event).catch(err => console.error(err));
    // Note: does not await, ignores return value
  }
}
```

**Used by**: `message_received`

### Modifying Hooks

Modifying hooks execute synchronously. They can return modifications that are merged into the event or context.

```javascript
// OpenClaw extensionAPI.js (simplified)
async runModifyingHook(hookName, event) {
  const handlers = this.hooks.get(hookName);
  let result = {};
  for (const handler of handlers) {
    const mod = await handler(event);
    if (mod) Object.assign(result, mod);
  }
  return result;
}
```

**Used by**: `before_agent_start`, `before_tool_call`, `message_sending`

## Hook Events

### agent:bootstrap

Fires when an agent initializes.

**Event Shape**:
```typescript
interface AgentBootstrapEvent {
  type: "agent";
  action: "bootstrap";
  context: {
    workspaceDir?: string;
    bootstrapFiles?: BootstrapFile[];
    cfg?: Record<string, unknown>;
  };
}
```

**Plugin Hook**: `prisma-airs-guard`

**Modification**: Adds to `bootstrapFiles` array

### message_received

Fires when a message arrives at the gateway.

**Event Shape**:
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
    messageId?: string;
    senderId?: string;
    senderName?: string;
  };
}
```

**Plugin Hook**: `prisma-airs-audit`

**Modification**: None (void hook)

!!! warning "Cannot Block"
    `message_received` is fire-and-forget. The plugin caches scan results for downstream hooks to use.

### before_agent_start

Fires before the agent begins processing a message.

**Event Shape**:
```typescript
interface BeforeAgentStartEvent {
  sessionKey?: string;
  message?: {
    content?: string;
    text?: string;
  };
  messages?: Array<{
    role: string;
    content?: string;
  }>;
}
```

**Plugin Hook**: `prisma-airs-context`

**Modification**:
```typescript
interface HookResult {
  prependContext?: string;  // Prepended to agent context
  systemPrompt?: string;    // Alternative system prompt
}
```

### before_tool_call

Fires before each tool invocation.

**Event Shape**:
```typescript
interface BeforeToolCallEvent {
  toolName: string;
  toolId?: string;
  params?: Record<string, unknown>;
}
```

**Plugin Hook**: `prisma-airs-tools`

**Modification**:
```typescript
interface HookResult {
  params?: Record<string, unknown>;  // Modified params
  block?: boolean;                   // Block the call
  blockReason?: string;              // Reason for blocking
}
```

### message_sending

Fires before sending a response.

**Event Shape**:
```typescript
interface MessageSendingEvent {
  content?: string;
  to?: string;
  channel?: string;
  metadata?: {
    sessionKey?: string;
    messageId?: string;
  };
}
```

**Plugin Hook**: `prisma-airs-outbound`

**Modification**:
```typescript
interface HookResult {
  content?: string;  // Modified content (or masked)
  cancel?: boolean;  // Cancel sending entirely
}
```

## Hook Execution Timeline

```
T0: User sends message
    │
T1: message_received fires (async)
    │   └── prisma-airs-audit: scan, cache, log
    │
T2: before_agent_start fires (sync)
    │   └── prisma-airs-context: check cache, inject warnings
    │
T3: Agent processes message
    │
T4: Agent calls tool
    │   └── before_tool_call fires
    │       └── prisma-airs-tools: check cache, block if needed
    │
T5: Agent generates response
    │
T6: message_sending fires (sync)
    │   └── prisma-airs-outbound: scan response, block/mask
    │
T7: Response sent to user
```

## Race Condition Handling

The `message_received` hook is async and may not complete before `before_agent_start`:

```
Timeline A (fast scan):
  T0: message_received starts
  T1: scan completes, cached
  T2: before_agent_start fires, cache HIT

Timeline B (slow scan):
  T0: message_received starts
  T1: before_agent_start fires, cache MISS → fallback scan
  T2: original scan completes (cached but unused)
```

The plugin handles this with fallback scanning in `before_agent_start` when cache misses occur.
