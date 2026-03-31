# Outbound Scanning

Scans assistant responses for data leakage, policy violations, and threats.

## Hooks Registered

| Event                                        | Behavior                                                |
| -------------------------------------------- | ------------------------------------------------------- |
| `message_sending`                            | Scan response — DLP mask or full block based on verdict |
| `before_message_write` (assistant role only) | Hard block unless AIRS returns "allow"                  |

## Config

Enabled by `outbound_scanning: true` (default).
