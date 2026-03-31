# Tool Protection

Scans and gates tool inputs/outputs across the tool lifecycle.

## Hooks Registered

| Event | Behavior |
|-------|----------|
| `before_tool_call` | Cache-based gating — blocks tools based on prior scan results (fast, no API call) |
| `before_tool_call` | Active AIRS scan of tool inputs — blocks unless AIRS allows |
| `tool_result_persist` | Sync regex DLP — masks PII/credentials in tool outputs before persistence |
| `after_tool_call` | Fire-and-forget audit scan of tool execution results |

## Config

Enabled by `tool_protection: true` (default).
