# prisma-airs-tool-guard

Active tool input scanning — scans tool call inputs through AIRS before execution.

## Overview

| Property      | Value                                                |
| ------------- | ---------------------------------------------------- |
| **Event**     | `before_tool_call`                                   |
| **Emoji**     | :lock:                                               |
| **Can Block** | Yes (`{ block: true, blockReason }`)                 |
| **Config**    | `tool_guard_mode`, `fail_closed`                     |

## Purpose

This hook:

1. Fires **before** each tool call
2. Builds a `toolEvent` with the tool's metadata and serialized arguments
3. Scans the tool event through Prisma AIRS
4. Blocks execution unless AIRS returns `action: "allow"`

## How It Differs from prisma-airs-tools

| Feature | prisma-airs-tools | prisma-airs-tool-guard |
| ------- | ----------------- | ---------------------- |
| Data source | Cached scan result | Active AIRS scan |
| Scans | Cached inbound result | Tool input via toolEvent |
| Latency | ~0ms (cache lookup) | AIRS API round-trip |
| Coverage | Threats in original message | Threats in tool arguments |

Use **both** for defense-in-depth: `prisma-airs-tools` catches threats from the conversation, `prisma-airs-tool-guard` catches threats in tool arguments.

## Configuration

```yaml
plugins:
  prisma-airs:
    config:
      tool_guard_mode: "deterministic" # default
      fail_closed: true # Block on scan failure (default)
```

## Tool Event Structure

The hook constructs a `toolEvent` for the AIRS scan:

```json
{
  "toolEvents": [{
    "metadata": {
      "ecosystem": "mcp",
      "method": "tool_call",
      "serverName": "filesystem",
      "toolInvoked": "read_file"
    },
    "input": "{\"path\":\"/etc/passwd\"}"
  }]
}
```

## Actions

| AIRS Action | Result                              |
| ----------- | ----------------------------------- |
| `allow`     | Tool execution proceeds             |
| `warn`      | **Blocked** — tool call rejected    |
| `block`     | **Blocked** — tool call rejected    |
| (error)     | Blocked if `fail_closed: true`      |

## Related Hooks

- [prisma-airs-tools](prisma-airs-tools.md) — Cache-based tool gating
- [prisma-airs-inbound-block](prisma-airs-inbound-block.md) — User message blocking
