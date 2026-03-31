# LLM Audit

Deep scans all LLM prompts and responses. Expensive — primarily for compliance.

## Hooks Registered

| Event | Behavior |
|-------|----------|
| `llm_input` | Fire-and-forget scan of prompt sent to LLM |
| `llm_output` | Fire-and-forget scan of response received from LLM |
| `before_prompt_build` | Scan full conversation context, inject warning if threats detected |

## Config

Enabled by `llm_audit: true` (default: **false** — opt-in due to cost).
