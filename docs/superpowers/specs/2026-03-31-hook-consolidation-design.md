# Hook Consolidation Design — v2.1.0

## Problem

Issue #49 uncovered several problems with v2.0.x:

1. `before_message_write` handlers are `async` but the hook is synchronous in OpenClaw — `{ block: true }` is silently dropped, so blocking never works.
2. 12 hooks with caching, context injection, and multiple overlapping scan points create complexity without proportional security value.
3. Version strings are stale (still say 2.0.0).
4. No hookCtx integration tests — the `_hookCtx` bug pattern (v2.0.0) would not have been caught.

## Solution

Replace all 12 hooks with 4 hooks. No caching. Every scan is live against AIRS. All blocking hooks use events that support async handlers.

## Architecture

### Hook Inventory

| Handler file | Hook event | Async? | Can block? | Scan content |
|---|---|---|---|---|
| `hooks/prompt-guard/handler.ts` | `before_prompt_build` | Yes (awaited) | Via context injection | `scan({ prompt })` |
| `hooks/response-guard/handler.ts` | `message_sending` | Yes (awaited) | Yes — replaces content | `scan({ response })` |
| `hooks/tool-input-guard/handler.ts` | `before_tool_call` | Yes (awaited) | Yes — `{ block: true }` | `scan({ toolEvents })` |
| `hooks/tool-output-audit/handler.ts` | `after_tool_call` | Yes (fire-and-forget) | No | `scan({ response, toolEvents })` |

### Why not `before_message_write`?

OpenClaw's `before_message_write` is the only sync hook that does NOT await Promises. Since `scan()` makes an HTTP call to AIRS (inherently async), this hook cannot perform live scanning. The alternatives:

- `before_prompt_build` — fires before the LLM sees the assembled prompt. Awaits async. Cannot return `{ block }` but can inject `{ prependSystemContext }` with a refusal directive.
- `message_sending` — fires before the user sees the response. Awaits async. Can replace content or cancel.

Persistence-layer blocking (preventing messages from being written to conversation history) is not a goal — only preventing unsafe content from reaching the LLM or the user matters.

### Hook Behavior

**prompt-guard** (`before_prompt_build`):
- Extracts latest user message from event's conversation messages array
- Scans it via `scan({ prompt })`
- `action === "allow"` → return void
- Not allow → return `{ prependSystemContext: warning }` with category-specific refusal directive
- Scan error + `fail_closed` → inject refusal
- Scan error + `fail_open` → return void

**response-guard** (`message_sending`):
- Scans response via `scan({ response: content })`
- `action === "allow"` → return void, pass through
- DLP-only violation + `dlp_mask_only` → return `{ content: maskSensitiveData(content) }`
- Any other non-allow → return `{ content: blockMessage }`
- Scan error + `fail_closed` → return block message
- Scan error + `fail_open` → return void

**tool-input-guard** (`before_tool_call`):
- Builds `toolEvent` from tool metadata + serialized params
- Scans via `scan({ toolEvents: [{ metadata, input }] })`
- `action === "allow"` → return void
- Not allow → return `{ block: true, blockReason }`
- Scan error + `fail_closed` → block
- Scan error + `fail_open` → allow

**tool-output-audit** (`after_tool_call`):
- Serializes tool result
- Scans via `scan({ response: resultStr, toolEvents: [{ metadata, output }] })`
- Logs structured JSON audit event
- No return value (fire-and-forget)
- Errors caught and logged, never thrown

All handlers: `getConfig(hookCtx(ctx))` → scan → decide → structured log → return.

### Lifecycle Position

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

## Configuration

### Config keys (3 toggles, down from 5)

| Key | Type | Default | Controls |
|---|---|---|---|
| `api_key` | string | — | AIRS API key |
| `profile_name` | string | — | AIRS security profile |
| `app_name` | string | `"openclaw"` | App identifier in scans |
| `fail_closed` | boolean | `true` | Block on scan errors |
| `dlp_mask_only` | boolean | `true` | Mask DLP violations instead of blocking |
| `prompt_scanning` | boolean | `true` | Enable prompt-guard |
| `response_scanning` | boolean | `true` | Enable response-guard |
| `tool_protection` | boolean | `true` | Enable tool-input-guard + tool-output-audit |

### Removed config keys

- `inbound_scanning` — renamed to `prompt_scanning`
- `outbound_scanning` — renamed to `response_scanning`
- `security_context` — hook group deleted
- `llm_audit` — hook group deleted

### index.ts registration

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

## Deletions

### Files to delete

| Path | Reason |
|---|---|
| `hooks/inbound/` | Replaced by prompt-guard |
| `hooks/outbound/` | Replaced by response-guard |
| `hooks/tool-protection/` | Split into tool-input-guard + tool-output-audit |
| `hooks/security-context/` | Removed — no more context injection or guard reminders |
| `hooks/llm-audit/` | Removed — no more LLM I/O audit |
| `src/scan-cache.ts` | No caching |
| `src/scan-cache.test.ts` | No caching |

### Files to keep

| Path | Reason |
|---|---|
| `src/scanner.ts` | Core scan function, unchanged |
| `src/scanner.test.ts` | Scanner tests, unchanged |
| `src/dlp.ts` | Used by response-guard for DLP masking |
| `src/dlp.test.ts` | DLP tests, unchanged |
| `src/config.ts` | Rewritten for new config shape |

## Version Bump

All version references updated to `2.1.0`:

- `package.json` version field
- `openclaw.plugin.json` version field
- `index.ts` line 2 (comment)
- `index.ts` startup log
- `index.ts` status RPC response
- `index.ts` CLI output
- `index.ts` export const

Minor bump (not patch) because config keys are renamed/removed — breaking change for existing deployments.

## Testing

### New test files

- `hooks/prompt-guard/handler.test.ts`
- `hooks/response-guard/handler.test.ts`
- `hooks/tool-input-guard/handler.test.ts`
- `hooks/tool-output-audit/handler.test.ts`

### Test coverage per handler

1. **hookCtx is called** — mock hookCtx records calls, assert called per invocation
2. **allow** → correct pass-through return
3. **block/warn** → correct blocking return
4. **scan error + fail_closed** → blocks
5. **scan error + fail_open** → passes through
6. **empty/missing content** → early return, no scan called
7. **structured log output** — correct event name and fields

### Tests to delete

- `src/scan-cache.test.ts`

### Tests to rewrite

- `src/config.test.ts` — new config shape (3 toggles, renamed keys)
- `index.test.ts` — new registration groups

### Tests unchanged

- `src/scanner.test.ts`
- `src/dlp.test.ts`
