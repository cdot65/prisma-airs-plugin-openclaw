# prisma-airs-outbound-block

Hard outbound blocking — prevents assistant messages from being persisted unless AIRS allows them.

## Overview

| Property      | Value                                                |
| ------------- | ---------------------------------------------------- |
| **Event**     | `before_message_write`                               |
| **Emoji**     | :no_entry:                                           |
| **Can Block** | Yes (`{ block: true }`)                              |
| **Config**    | `outbound_block_mode`, `fail_closed`                 |

## Purpose

This hook:

1. Fires **before** an assistant message is written to conversation history
2. Scans assistant responses through Prisma AIRS
3. Blocks any message where AIRS does not return `action: "allow"`
4. Blocked messages are never persisted or shown to the user

## How It Differs from prisma-airs-outbound

| Feature | prisma-airs-outbound | prisma-airs-outbound-block |
| ------- | -------------------- | -------------------------- |
| Event   | `message_sending`    | `before_message_write`     |
| Timing  | Before display       | Before persistence         |
| DLP     | Can mask content     | Block only                 |
| Result  | `{ content, cancel }` | `{ block: true }`         |

Use **both** for defense-in-depth: outbound-block prevents persistence, outbound handles display-level masking/blocking.

## Configuration

```yaml
plugins:
  prisma-airs:
    config:
      outbound_block_mode: "deterministic" # default
      fail_closed: true # Block on scan failure (default)
```

## Actions

| AIRS Action | Result                           |
| ----------- | -------------------------------- |
| `allow`     | Message persisted normally       |
| `warn`      | **Blocked** — message rejected   |
| `block`     | **Blocked** — message rejected   |
| (error)     | Blocked if `fail_closed: true`   |

## Role Filtering

Only **assistant** messages are scanned. User messages are skipped (handled by the [inbound block hook](prisma-airs-inbound-block.md)).

## Related Hooks

- [prisma-airs-inbound-block](prisma-airs-inbound-block.md) — Inbound (user) message blocking
- [prisma-airs-outbound](prisma-airs-outbound.md) — Display-level blocking and DLP masking
