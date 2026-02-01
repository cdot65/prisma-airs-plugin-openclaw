# @cdot65/prisma-airs

OpenClaw plugin for [Prisma AIRS](https://www.paloaltonetworks.com/prisma/ai-runtime-security) (AI Runtime Security) from Palo Alto Networks.

## Features

- **Gateway RPC**: `prisma-airs.scan`, `prisma-airs.status`
- **Agent Tool**: `prisma_airs_scan`
- **CLI**: `openclaw prisma-airs`, `openclaw prisma-airs-scan`
- **Bootstrap Hook**: Security reminder on agent startup

**Detection capabilities:**

- Prompt injection
- Data leakage (DLP)
- Malicious URLs
- Toxic content
- Database security
- Malicious code

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

**Option A: Environment variable**

```bash
export PANW_AI_SEC_API_KEY="your-key"
```

**Option B: systemd service (Linux)**

```bash
# Create override file
mkdir -p ~/.config/systemd/user/openclaw-gateway.service.d
cat > ~/.config/systemd/user/openclaw-gateway.service.d/env.conf << 'EOF'
[Service]
Environment=PANW_AI_SEC_API_KEY=your-key-here
EOF

# Reload and restart
systemctl --user daemon-reload
openclaw gateway restart
```

### 2. Plugin Config (optional)

```bash
# Via CLI
openclaw config set plugins.entries.prisma-airs.config.profile_name "my-profile"
openclaw config set plugins.entries.prisma-airs.config.app_name "my-app"
```

Or in `~/.openclaw/openclaw.json`:

```json
{
  "plugins": {
    "entries": {
      "prisma-airs": {
        "config": {
          "profile_name": "default",
          "app_name": "openclaw",
          "reminder_enabled": true
        }
      }
    }
  }
}
```

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
- OpenClaw Gateway
- Prisma AIRS API key ([Strata Cloud Manager](https://docs.paloaltonetworks.com/ai-runtime-security))

## Links

- [GitHub](https://github.com/cdot65/prisma-airs-plugin-openclaw)
- [Prisma AIRS Docs](https://docs.paloaltonetworks.com/ai-runtime-security)
- [API Reference](https://pan.dev/prisma-airs/)

## License

MIT
