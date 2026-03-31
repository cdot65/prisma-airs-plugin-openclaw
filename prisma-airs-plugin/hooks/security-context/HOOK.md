# Security Context

Injects security reminders and threat warnings into agent context.

## Hooks Registered

| Event | Behavior |
|-------|----------|
| `before_agent_start` | Inject static security scanning reminder into system prompt |
| `before_agent_start` | Inject dynamic threat warnings based on scan results |

## Config

Enabled by `security_context: true` (default).
