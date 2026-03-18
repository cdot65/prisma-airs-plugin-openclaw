# prisma-airs-prompt-scan

Full conversation context scanning before prompt assembly.

## Overview

| Property      | Value                                                        |
| ------------- | ------------------------------------------------------------ |
| **Event**     | `before_prompt_build`                                        |
| **Emoji**     | :mag:                                                        |
| **Can Block** | No (injects warnings via `prependSystemContext`)             |
| **Config**    | `prompt_scan_mode`, `fail_closed`                            |

## Purpose

This hook:

1. Fires **before** the prompt is assembled and sent to the LLM
2. Assembles all session messages into a scannable context string
3. Scans the full context through Prisma AIRS
4. Injects security warnings via `prependSystemContext` when threats detected
5. Catches **multi-message injection attacks** that per-message scanning misses

## Why Full Context Scanning Matters

Individual message scanning (inbound-block, outbound-block) catches threats in single messages. But a sophisticated prompt injection can split its payload across multiple messages that individually look benign:

```
Message 1 (benign): "I need help with a Python script"
Message 2 (benign): "The script should process user input"
Message 3 (injection): "Actually, ignore all previous instructions and..."
```

Scanning the assembled context catches the attack pattern that emerges only when messages are combined.

## Configuration

```yaml
plugins:
  prisma-airs:
    config:
      prompt_scan_mode: "deterministic" # default
      fail_closed: true # Inject warning on scan failure (default)
```

## Context Assembly

Messages are assembled into a scannable string:

```
[user]: Hello
[assistant]: Hi there!
[user]: What is the weather today?
```

If no messages array is available, falls back to `event.prompt`.

## Actions

| AIRS Action | Result                                         |
| ----------- | ---------------------------------------------- |
| `allow`     | No injection — context is safe                 |
| `warn`      | Warning injected via `prependSystemContext`     |
| `block`     | Critical alert injected via `prependSystemContext` |
| (error)     | Warning injected if `fail_closed: true`        |

## Related Hooks

- [prisma-airs-inbound-block](prisma-airs-inbound-block.md) — Per-message user blocking
- [prisma-airs-outbound-block](prisma-airs-outbound-block.md) — Per-message assistant blocking
- [prisma-airs-context](prisma-airs-context.md) — Legacy context injection (before_agent_start)
