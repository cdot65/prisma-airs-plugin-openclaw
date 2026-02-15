# Prisma AIRS Plugin

[![npm version](https://img.shields.io/npm/v/@cdot65/prisma-airs)](https://www.npmjs.com/package/@cdot65/prisma-airs)
[![Documentation](https://img.shields.io/badge/docs-GitHub%20Pages-blue)](https://cdot65.github.io/prisma-airs-plugin-openclaw/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

OpenClaw plugin for [Prisma AIRS](https://www.paloaltonetworks.com/prisma/prisma-ai-runtime-security) (AI Runtime Security) from Palo Alto Networks.

**[Documentation](https://cdot65.github.io/prisma-airs-plugin-openclaw/)** | **[Release Notes](RELEASE_NOTES.md)**

## Overview

Pure TypeScript plugin with direct AIRS API integration via `fetch()`.

**Provides:**
- **Gateway RPC**: `prisma-airs.scan` - Programmatic scanning
- **Agent Tool**: `prisma_airs_scan` - Agent-initiated scans
- **5 Security Hooks**: Defense-in-depth protection
  - `prisma-airs-guard` - Bootstrap reminder
  - `prisma-airs-audit` - Audit logging with scan caching
  - `prisma-airs-context` - Threat warning injection
  - `prisma-airs-outbound` - Response scanning/blocking/masking
  - `prisma-airs-tools` - Tool gating during threats

**Detection capabilities:**
- Prompt injection detection
- Data leakage prevention (DLP)
- Malicious URL filtering
- Toxic content detection
- Database security
- Malicious code detection
- AI agent protection
- Contextual grounding
- Custom topic guardrails

## Quick Start

### 1. Install

```bash
# From npm (recommended)
openclaw plugins install @cdot65/prisma-airs

# Or from local directory
openclaw plugins install ./prisma-airs-plugin
```

### 2. Restart Gateway

```bash
openclaw gateway restart
```

### 3. Configure API Key

Set the API key in plugin config (via gateway web UI or config file):

```yaml
plugins:
  prisma-airs:
    config:
      api_key: "your-key-from-strata-cloud-manager"
```

### 4. Verify

```bash
# Check plugin loaded
openclaw plugins list | grep prisma

# Check status
openclaw prisma-airs

# Test scan
openclaw prisma-airs-scan "test message"

# Test via RPC
openclaw gateway call prisma-airs.scan --params '{"prompt":"test"}'
```

## Plugin Structure

```
prisma-airs-plugin/
├── package.json
├── openclaw.plugin.json          # Plugin manifest
├── index.ts                      # Plugin entrypoint
├── src/
│   ├── scanner.ts                # TypeScript scanner
│   └── scan-cache.ts             # Result caching
└── hooks/
    ├── prisma-airs-guard/        # Bootstrap reminder
    ├── prisma-airs-audit/        # Audit logging + caching
    ├── prisma-airs-context/      # Threat warning injection
    ├── prisma-airs-outbound/     # Response scanning/blocking/masking
    └── prisma-airs-tools/        # Tool gating
```

## Configuration

### Plugin Config

```yaml
plugins:
  prisma-airs:
    config:
      api_key: "your-api-key"
      profile_name: "default"       # SCM profile name
      app_name: "openclaw"          # App metadata
      reminder_mode: "on"           # Bootstrap hook (on / off)
```

### Where to Configure What

| Setting | Where |
|---------|-------|
| API key | Plugin config (`api_key`) |
| Profile name | Plugin config |
| Detection services | Strata Cloud Manager |
| Actions (allow/block) | Strata Cloud Manager |
| DLP patterns | Strata Cloud Manager |

**Important**: Detection services and actions are configured in [Strata Cloud Manager](https://docs.paloaltonetworks.com/ai-runtime-security/activation-and-onboarding/ai-runtime-security-api-intercept-overview/onboard-api-runtime-security-api-intercept-in-scm), not in plugin config.

### API Key Setup

1. Log in to Strata Cloud Manager
2. Navigate to **Settings** → **Access Keys**
3. Create a new access key for AI Security
4. Set the key in plugin config (`api_key` field)

## Usage

### Gateway RPC

```bash
# Scan a prompt
openclaw gateway call prisma-airs.scan --params '{"prompt":"user input"}'

# Scan prompt and response
openclaw gateway call prisma-airs.scan --params '{"prompt":"user input","response":"ai output"}'

# Check status
openclaw gateway call prisma-airs.status
```

### Agent Tool

Agents can use the `prisma_airs_scan` tool directly:

```json
{
  "tool": "prisma_airs_scan",
  "params": {
    "prompt": "content to scan",
    "response": "optional AI response",
    "sessionId": "conversation-123",
    "trId": "tx-001"
  }
}
```

### CLI

```bash
# Scan text
openclaw prisma-airs-scan "message to scan"

# JSON output
openclaw prisma-airs-scan --json "message"

# Specify profile
openclaw prisma-airs-scan --profile strict "message"

# Check status
openclaw prisma-airs
```

### Programmatic (TypeScript)

```typescript
import { scan, ScanResult } from "prisma-airs-plugin";

const result: ScanResult = await scan({
  prompt: "user message",
  response: "ai response",
  sessionId: "conv-123",
  trId: "tx-001",
  appName: "my-agent",
});

if (result.action === "block") {
  console.log("Blocked:", result.categories);
}
```

## Bootstrap Hook

The `prisma-airs-guard` hook injects a security reminder into agent bootstrap, instructing agents to:

1. Scan suspicious content using `prisma_airs_scan` tool
2. Block requests with `action="block"` response
3. Handle warnings appropriately

Disable via config:
```yaml
plugins:
  prisma-airs:
    config:
      reminder_mode: "off"
```

## Detection Categories

| Category | Description |
|----------|-------------|
| `prompt_injection` | Injection attack detected |
| `dlp_prompt` | Sensitive data in prompt |
| `dlp_response` | Sensitive data in response |
| `url_filtering_prompt` | Malicious URL in prompt |
| `url_filtering_response` | Malicious URL in response |
| `toxic_content` | Harmful content detected |
| `db_security` | Dangerous database query |
| `malicious_code` | Harmful code detected |
| `ungrounded` | Response not grounded in context |
| `topic_violation` | Topic guardrail triggered |
| `safe` | No issues detected |

## ScanResult

```typescript
interface ScanResult {
  action: "allow" | "warn" | "block";
  severity: "SAFE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  categories: string[];
  scanId: string;
  reportId: string;
  profileName: string;
  promptDetected: { injection: boolean; dlp: boolean; urlCats: boolean };
  responseDetected: { dlp: boolean; urlCats: boolean };
  sessionId?: string;
  trId?: string;
  latencyMs: number;
  error?: string;
}
```

## Requirements

- Node.js 18+
- Prisma AIRS API key (from Strata Cloud Manager)
- API Security Profile configured in SCM

## Documentation

Full documentation available at **[cdot65.github.io/prisma-airs-plugin-openclaw](https://cdot65.github.io/prisma-airs-plugin-openclaw/)**

- [Getting Started](https://cdot65.github.io/prisma-airs-plugin-openclaw/getting-started/installation/)
- [Architecture](https://cdot65.github.io/prisma-airs-plugin-openclaw/architecture/overview/)
- [Hook Reference](https://cdot65.github.io/prisma-airs-plugin-openclaw/hooks/)
- [Configuration](https://cdot65.github.io/prisma-airs-plugin-openclaw/reference/configuration/)

## Links

- [Prisma AIRS Documentation](https://docs.paloaltonetworks.com/ai-runtime-security)
- [API Security Profile Setup](https://docs.paloaltonetworks.com/ai-runtime-security/administration/prevent-network-security-threats/api-intercept-create-configure-security-profile)
- [API Reference](https://pan.dev/prisma-airs/)

## License

MIT
