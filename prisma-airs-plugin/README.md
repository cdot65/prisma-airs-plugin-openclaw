# @cdot65/prisma-airs

OpenClaw plugin for [Prisma AIRS](https://www.paloaltonetworks.com/prisma/ai-runtime-security) (AI Runtime Security) from Palo Alto Networks.

## Features

- **Gateway RPC**: `prisma-airs.scan`, `prisma-airs.status`
- **Agent Tools**: `prisma_airs_scan`, `prisma_airs_scan_prompt`, `prisma_airs_scan_response`, `prisma_airs_check_tool_safety`
- **CLI**: `openclaw prisma-airs`, `openclaw prisma-airs-scan`
- **Deterministic hooks**: audit, context injection, outbound blocking, tool gating
- **Probabilistic tools**: model-driven scanning when deterministic hooks are overkill
- **Scanning modes**: per-feature `deterministic`, `probabilistic`, or `off`

**Detection capabilities:**

- Prompt injection
- Data leakage (DLP)
- Malicious URLs
- Toxic content
- Database security
- Malicious code
- AI agent threats
- Grounding violations
- Custom topic guardrails

## Installation

### Install from npm

```bash
openclaw plugins install @cdot65/prisma-airs
```

### Restart Gateway

```bash
# systemd (Linux)
openclaw gateway restart

# or manually
openclaw gateway stop && openclaw gateway start
```

### Verify Installation

```bash
# Check plugin is loaded
openclaw plugins list | grep prisma

# Check status
openclaw prisma-airs
```

## Configuration

### 1. Set API Key

Get your API key from [Strata Cloud Manager](https://docs.paloaltonetworks.com/ai-runtime-security).

Set it in plugin config (via gateway web UI or config file):

```json
{
  "plugins": {
    "entries": {
      "prisma-airs": {
        "config": {
          "api_key": "your-key"
        }
      }
    }
  }
}
```

### 2. Plugin Config (optional)

```json
{
  "plugins": {
    "entries": {
      "prisma-airs": {
        "config": {
          "api_key": "your-key",
          "profile_name": "default",
          "app_name": "openclaw",
          "reminder_mode": "on",
          "audit_mode": "deterministic",
          "context_injection_mode": "deterministic",
          "outbound_mode": "deterministic",
          "tool_gating_mode": "deterministic"
        }
      }
    }
  }
}
```

### Scanning Modes

Each security feature supports three modes:

| Mode            | Behavior                                                                   |
| --------------- | -------------------------------------------------------------------------- |
| `deterministic` | Hook fires on every event (default). Scanning is automatic and guaranteed. |
| `probabilistic` | Registers a tool instead of a hook. The model decides when to scan.        |
| `off`           | Feature is disabled entirely.                                              |

**Reminder mode** is simpler: `on` (default) or `off`.

| Setting                  | Values                                    | Default         |
| ------------------------ | ----------------------------------------- | --------------- |
| `audit_mode`             | `deterministic` / `probabilistic` / `off` | `deterministic` |
| `context_injection_mode` | `deterministic` / `probabilistic` / `off` | `deterministic` |
| `outbound_mode`          | `deterministic` / `probabilistic` / `off` | `deterministic` |
| `tool_gating_mode`       | `deterministic` / `probabilistic` / `off` | `deterministic` |
| `reminder_mode`          | `on` / `off`                              | `on`            |

**Probabilistic tools** registered when a feature is set to `probabilistic`:

- `prisma_airs_scan_prompt` — replaces audit + context injection
- `prisma_airs_scan_response` — replaces outbound scanning
- `prisma_airs_check_tool_safety` — replaces tool gating

**Backward compatibility**: Old boolean flags (`audit_enabled`, `context_injection_enabled`, etc.) still work. `true` maps to `deterministic`, `false` maps to `off`. New `*_mode` fields take precedence.

**`fail_closed` constraint**: When `fail_closed=true` (default), all features must be `deterministic` or `off`. Probabilistic mode is rejected because the model might skip scanning.

## Usage

### CLI

```bash
# Check status
openclaw prisma-airs

# Scan text
openclaw prisma-airs-scan "message to scan"
openclaw prisma-airs-scan --json "message"
```

### Gateway RPC

```bash
# Status
openclaw gateway call prisma-airs.status

# Scan
openclaw gateway call prisma-airs.scan --params '{"prompt":"user input"}'
```

### Agent Tool

Agents can use `prisma_airs_scan` directly:

```json
{
  "tool": "prisma_airs_scan",
  "params": {
    "prompt": "content to scan",
    "sessionId": "conversation-123"
  }
}
```

### TypeScript

```typescript
import { scan } from "@cdot65/prisma-airs";

const result = await scan({
  prompt: "user message",
  sessionId: "conv-123",
  apiKey: "your-api-key",
});

if (result.action === "block") {
  console.log("Blocked:", result.categories);
}
```

## ScanResult

```typescript
interface ScanResult {
  action: "allow" | "warn" | "block";
  severity: "SAFE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  categories: string[];
  scanId: string;
  reportId: string;
  profileName: string;
  promptDetected: {
    injection: boolean;
    dlp: boolean;
    urlCats: boolean;
    toxicContent: boolean;
    maliciousCode: boolean;
    agent: boolean;
    topicViolation: boolean;
  };
  responseDetected: {
    dlp: boolean;
    urlCats: boolean;
    dbSecurity: boolean;
    toxicContent: boolean;
    maliciousCode: boolean;
    agent: boolean;
    ungrounded: boolean;
    topicViolation: boolean;
  };
  sessionId?: string;
  trId?: string;
  latencyMs: number;
  timeout: boolean;
  hasError: boolean;
  contentErrors: ContentError[];
  error?: string;
}
```

## Requirements

- Node.js 18+
- OpenClaw Gateway
- Prisma AIRS API key ([Strata Cloud Manager](https://docs.paloaltonetworks.com/ai-runtime-security))

## Links

- [GitHub](https://github.com/cdot65/prisma-airs-plugin-openclaw)
- [Prisma AIRS Docs](https://docs.paloaltonetworks.com/ai-runtime-security)
- [API Reference](https://pan.dev/prisma-airs/)

## License

MIT
