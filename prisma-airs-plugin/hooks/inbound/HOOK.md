# Inbound Scanning

Scans and enforces policy on user messages.

## Hooks Registered

| Event                                   | Behavior                                                       |
| --------------------------------------- | -------------------------------------------------------------- |
| `message_received`                      | Fire-and-forget audit scan, caches result for downstream hooks |
| `before_message_write` (user role only) | Hard block unless AIRS returns "allow"                         |

## Config

Enabled by `inbound_scanning: true` (default).
