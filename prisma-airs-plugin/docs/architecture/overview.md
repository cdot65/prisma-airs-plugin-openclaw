# Architecture Overview

## Components

The Prisma AIRS plugin consists of:

| Component        | File                 | Purpose                                   |
| ---------------- | -------------------- | ----------------------------------------- |
| **Scanner**      | `src/scanner.ts`     | Direct AIRS API integration via `fetch()` |
| **Scan Cache**   | `src/scan-cache.ts`  | Share scan results between hooks          |
| **Plugin Entry** | `index.ts`           | RPC methods, CLI, agent tool registration |
| **Hooks**        | `hooks/*/handler.ts` | Event handlers for security layers        |

## Data Flow

```mermaid
sequenceDiagram
    participant User
    participant Gateway
    participant Audit as prisma-airs-audit
    participant Context as prisma-airs-context
    participant Agent
    participant Tools as prisma-airs-tools
    participant Outbound as prisma-airs-outbound
    participant AIRS as Prisma AIRS API

    User->>Gateway: Send message
    Gateway->>Audit: message_received
    Audit->>AIRS: Scan prompt
    AIRS-->>Audit: ScanResult
    Audit->>Audit: Cache result
    Audit->>Audit: Log audit

    Gateway->>Context: before_agent_start
    Context->>Context: Check cache
    alt Cache hit
        Context->>Context: Use cached result
    else Cache miss
        Context->>AIRS: Fallback scan
        AIRS-->>Context: ScanResult
    end
    Context-->>Agent: Inject warnings (if threat)

    Agent->>Tools: Tool call
    Tools->>Tools: Check cache
    alt Threat detected
        Tools-->>Agent: Block tool
    else Safe
        Tools-->>Agent: Allow tool
    end

    Agent->>Outbound: Send response
    Outbound->>AIRS: Scan response
    AIRS-->>Outbound: ScanResult
    alt Block
        Outbound-->>User: Blocked message
    else DLP
        Outbound->>Outbound: Mask sensitive data
        Outbound-->>User: Masked response
    else Allow
        Outbound-->>User: Original response
    end
```

## Hook Execution Order

```mermaid
flowchart LR
    A[message_received<br/>async] --> B[before_agent_start<br/>sync]
    B --> C[Agent runs]
    C --> D[before_tool_call<br/>per tool]
    D --> E[message_sending<br/>sync]
```

| Event                | Timing                  | Can Block | Returns                       |
| -------------------- | ----------------------- | --------- | ----------------------------- |
| `message_received`   | Async (fire-and-forget) | No        | void                          |
| `before_agent_start` | Before agent processes  | No\*      | `{ prependContext }`          |
| `before_tool_call`   | Before each tool        | Yes       | `{ block, blockReason }`      |
| `message_sending`    | Before sending          | Yes       | `{ content }` or `{ cancel }` |

\*Cannot directly block, but can inject warnings

## Scan Cache Architecture

The cache bridges async and sync hooks:

```mermaid
flowchart TB
    subgraph message_received [Async Phase]
        A[Scan message] --> B[Hash message]
        B --> C[Cache result]
    end

    subgraph before_agent_start [Sync Phase]
        D[Get cache] --> E{Match?}
        E -->|Yes| F[Use cached]
        E -->|No| G[Fallback scan]
    end

    C -.-> D
```

### Cache Entry Structure

```typescript
interface CacheEntry {
  result: ScanResult; // Scan result
  timestamp: number; // Cache time
  messageHash?: string; // For stale detection
}
```

### TTL and Cleanup

- **TTL**: 30 seconds
- **Cleanup**: Every 60 seconds
- **Hash validation**: Prevents using results from previous messages

## Plugin Registration

```typescript
export default function register(api: PluginApi): void {
  // 1. Register hooks from directory
  api.registerPluginHooksFromDir(join(__dirname, "hooks"));

  // 2. Register RPC methods
  api.registerGatewayMethod("prisma-airs.scan", handler);
  api.registerGatewayMethod("prisma-airs.status", handler);

  // 3. Register agent tool
  api.registerTool({
    name: "prisma_airs_scan",
    execute: async (_id, params) => scan(params),
  });

  // 4. Register CLI commands
  api.registerCli(({ program }) => {
    program.command("prisma-airs");
    program.command("prisma-airs-scan <text>");
  });
}
```

## AIRS API Integration

### Request Flow

```typescript
const response = await fetch(AIRS_SCAN_ENDPOINT, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-pan-token": apiKey,
  },
  body: JSON.stringify({
    ai_profile: { profile_name: "default" },
    contents: [{ prompt: "...", response: "..." }],
    metadata: { app_name: "openclaw" },
  }),
});
```

### Response Mapping

| AIRS Field            | Plugin Field                |
| --------------------- | --------------------------- |
| `action`              | `action` (allow/warn/block) |
| `category`            | Mapped to severity          |
| `prompt_detected.*`   | `promptDetected.*`          |
| `response_detected.*` | `responseDetected.*`        |
| `scan_id`             | `scanId`                    |
| `report_id`           | `reportId`                  |

## Error Handling

### Fail-Closed Mode (Default)

On scan failure:

1. Cache synthetic "block" result
2. Downstream hooks see threat
3. Tools blocked, warnings injected

### Fail-Open Mode

On scan failure:

1. Log error
2. Allow request through
3. No cached result

Configure via `fail_closed: false`.
