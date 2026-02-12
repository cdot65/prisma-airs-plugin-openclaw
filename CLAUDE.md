# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Run tests
cd prisma-airs-plugin && npm test

# Run tests in watch mode
cd prisma-airs-plugin && npm run test:watch

# Install plugin to OpenClaw
openclaw plugins install ./prisma-airs-plugin

# Test scan via CLI
openclaw prisma-airs-scan "test message"

# Test scan via RPC
openclaw gateway call prisma-airs.scan --params '{"prompt":"test"}'

# Check status
openclaw prisma-airs
```

## Architecture

Pure TypeScript OpenClaw plugin wrapping Prisma AIRS REST API.

**Components:**
- `prisma-airs-plugin/src/scanner.ts` - TypeScript scanner with direct `fetch()` to AIRS API
- `prisma-airs-plugin/index.ts` - Plugin entrypoint with RPC method + agent tool registration
- `prisma-airs-plugin/hooks/prisma-airs-guard/` - Bootstrap reminder hook

**Data flow:**
```
Agent → Gateway RPC → prisma-airs.scan (TypeScript) → fetch() → AIRS API
  or
Agent → prisma_airs_scan tool → scan() → fetch() → AIRS API
```

**Key types:**
- `Action`: "allow" | "warn" | "block"
- `Severity`: "SAFE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
- `ScanRequest`: prompt, response, sessionId, trId, profileName, appName, appUser, aiModel, apiKey, toolEvents
- `ScanResult`: action, severity, categories, scanId, reportId, promptDetected, responseDetected

## Config: Plugin vs Strata Cloud Manager

| Setting | Where to Configure |
|---------|-------------------|
| API key | Plugin config (`api_key`) |
| Profile name | Plugin config |
| App name | Plugin config |
| Detection services | Strata Cloud Manager |
| Actions (allow/block) | Strata Cloud Manager |
| DLP patterns, URL categories | Strata Cloud Manager |

## AIRS API

**Endpoint:** `https://service.api.aisecurity.paloaltonetworks.com/v1/scan/sync/request`

**Headers:**
- `x-pan-token`: API key
- `Content-Type`: application/json

**Request:**
```json
{
  "ai_profile": { "profile_name": "default" },
  "contents": [{ "prompt": "...", "response": "..." }],
  "metadata": { "app_name": "openclaw" },
  "tr_id": "optional",
  "session_id": "optional"
}
```

**Response:** action, category, scan_id, report_id, prompt_detected, response_detected

## Detection Categories

| Category | Detection Service |
|----------|------------------|
| `prompt_injection` | Prompt Injection Detection |
| `dlp_prompt` | Sensitive Data (prompt) |
| `dlp_response` | Sensitive Data (response) |
| `url_filtering_prompt` | Malicious URL (prompt) |
| `url_filtering_response` | Malicious URL (response) |
| `toxic_content` | Toxic Content |
| `db_security` | Database Security |
| `malicious_code` | Malicious Code |
| `ungrounded` | Contextual Grounding |
| `topic_violation` | Custom Topic Guardrails |
| `safe` | No threats detected |

## Development

Run from `prisma-airs-plugin/` directory:

```bash
npm run check       # Full suite: typecheck + lint + format + test
npm run typecheck   # TypeScript type checking
npm run lint        # ESLint
npm run lint:fix    # ESLint with auto-fix
npm run format      # Prettier format
npm run test        # Run tests once
npm run test:watch  # Watch mode
```

**Pre-commit hook** runs automatically on commit:
1. Type check
2. Lint + format staged files
3. Run tests

Test files:
- `src/scanner.test.ts` - Scanner unit tests (mocked fetch)
- `hooks/prisma-airs-guard/handler.test.ts` - Hook handler tests
