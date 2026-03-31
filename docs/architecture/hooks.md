# Hook Lifecycle (v2.1.0)

## Overview

4 hooks, each registering a single event via `api.on()` in `index.ts`. All scanning is live against AIRS — no caching. Each hook is boolean-gated by its config toggle.

## Hook Events

| Event                 | Handler               | Async? | Can Block?              | Config Toggle        |
|-----------------------|-----------------------|--------|-------------------------|----------------------|
| `before_prompt_build` | prompt-guard          | Yes    | Via context injection   | `prompt_scanning`    |
| `message_sending`     | response-guard        | Yes    | Yes — replaces content  | `response_scanning`  |
| `before_tool_call`    | tool-input-guard      | Yes    | Yes — `{ block: true }` | `tool_protection`    |
| `after_tool_call`     | tool-output-audit     | Yes    | No (fire-and-forget)    | `tool_protection`    |

## Hook Details

### prompt-guard (`before_prompt_build`)

Scans the latest user message via `scan({ prompt })`. On `action === "allow"`, returns void. On any other action, returns `{ prependSystemContext: warning }` with a category-specific refusal directive. On scan error + `fail_closed`, injects a generic refusal. On scan error + `fail_open`, returns void.

### response-guard (`message_sending`)

Scans the assistant response via `scan({ response })`. On `action === "allow"`, returns void. For DLP-only violations with `dlp_mask_only=true`, masks content via `maskSensitiveData()` regex patterns (SSN, credit cards, emails, API keys, AWS keys, phone numbers, private IPs). For all other non-allow actions, returns `{ content: blockMessage }`. On scan error + `fail_closed`, blocks. On scan error + `fail_open`, returns void.

### tool-input-guard (`before_tool_call`)

Scans tool inputs via `scan({ toolEvents: [{ metadata, input }] })` using the SDK's `toolEvent` content type. Metadata includes `ecosystem: "mcp"`, `method: "tool_call"`, `serverName`, and `toolInvoked`. On `action === "allow"`, returns void. On any other action, returns `{ block: true, blockReason }`. On scan error + `fail_closed`, blocks. On scan error + `fail_open`, returns void.

### tool-output-audit (`after_tool_call`)

Fire-and-forget scan of tool outputs via `scan({ response, toolEvents: [{ metadata, output }] })`. Logs structured JSON audit events. Cannot block — `after_tool_call` is async void. Tool outputs are indirectly covered by response-guard when they flow into the assistant response. Errors are caught and logged, never thrown.

## Execution Order

```
User types message
  → before_prompt_build          ← prompt-guard (inject refusal if not allow)
  → LLM processes
  → before_tool_call             ← tool-input-guard (block if not allow)
  → tool executes
  → after_tool_call              ← tool-output-audit (fire-and-forget)
  → message_sending              ← response-guard (replace content if not allow)
  → User sees response
```

## Registration

```typescript
const hookCtx = (ctx: any) => ({ ...ctx, cfg: api.config });
let hookCount = 0;

if (config.prompt_scanning) {
  hookCount += registerPromptGuardHooks(api, hookCtx);
}
if (config.response_scanning) {
  hookCount += registerResponseGuardHooks(api, hookCtx);
}
if (config.tool_protection) {
  hookCount += registerToolInputGuardHooks(api, hookCtx);
  hookCount += registerToolOutputAuditHooks(api, hookCtx);
}
```

All handlers receive `hookCtx` and must call it on `ctx` before reading config: `getConfig(hookCtx(ctx))`. This wraps the OpenClaw context with `{ cfg: api.config }` so handlers can access plugin config.

## Config

| Key                  | Type    | Default    | Controls                              |
|----------------------|---------|------------|---------------------------------------|
| `api_key`            | string  | —          | AIRS API key                          |
| `profile_name`       | string  | —          | AIRS security profile                 |
| `app_name`           | string  | `"openclaw"` | App identifier in scans             |
| `fail_closed`        | boolean | `true`     | Block on scan errors                  |
| `dlp_mask_only`      | boolean | `true`     | Mask DLP violations instead of blocking |
| `prompt_scanning`    | boolean | `true`     | Enable prompt-guard                   |
| `response_scanning`  | boolean | `true`     | Enable response-guard                 |
| `tool_protection`    | boolean | `true`     | Enable tool-input-guard + tool-output-audit |
