# Prisma AIRS Plugin

[![npm version](https://img.shields.io/npm/v/@cdot65/prisma-airs)](https://www.npmjs.com/package/@cdot65/prisma-airs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

OpenClaw plugin for [Prisma AIRS](https://www.paloaltonetworks.com/prisma/prisma-ai-runtime-security) (AI Runtime Security) from Palo Alto Networks.

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                  Strata Cloud Manager                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Security Profile: "your-profile-name"               │   │
│  │ - Prompt Injection: block                           │   │
│  │ - DLP: alert                                        │   │
│  │ - Malicious URLs: block                             │   │
│  │ - ... (all detection config here)                   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ API calls
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    OpenClaw Gateway                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ prisma-airs plugin                                  │   │
│  │ - api_key (plugin config)                           │   │
│  │ - profile_name (plugin config)                      │   │
│  │ - Sends prompts/responses to AIRS API               │   │
│  │ - Enforces actions returned by AIRS                 │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**All guardrail configuration happens in Strata Cloud Manager.** This plugin just connects to your SCM security profile and enforces the actions it returns.

## Quick Start

```bash
# 1. Install plugin
openclaw plugins install @cdot65/prisma-airs

# 2. Set API key in plugin config (via gateway web UI or config file)
#    plugins.entries.prisma-airs.config.api_key = "your-api-key"

# 3. Restart gateway
openclaw gateway restart

# 4. Test
openclaw prisma-airs-scan "test message"
```

## What You Configure Where

| Configuration                          | Where                          |
| -------------------------------------- | ------------------------------ |
| Detection services (what to detect)    | Strata Cloud Manager           |
| Actions (allow/alert/block)            | Strata Cloud Manager           |
| DLP patterns, URL categories           | Strata Cloud Manager           |
| API key                                | Plugin config (`api_key`)      |
| Profile name                           | Plugin config (`profile_name`) |
| Plugin behavior (enable/disable hooks) | OpenClaw plugin config         |

## Features

### Multi-Layer Security Hooks

| Hook                                                  | Event                | Purpose                                   |
| ----------------------------------------------------- | -------------------- | ----------------------------------------- |
| [prisma-airs-guard](hooks/prisma-airs-guard.md)       | `agent:bootstrap`    | Reminds agents to scan suspicious content |
| [prisma-airs-audit](hooks/prisma-airs-audit.md)       | `message_received`   | Audit logging with scan caching           |
| [prisma-airs-context](hooks/prisma-airs-context.md)   | `before_agent_start` | Injects threat warnings into context      |
| [prisma-airs-outbound](hooks/prisma-airs-outbound.md) | `message_sending`    | Blocks/masks outbound responses           |
| [prisma-airs-tools](hooks/prisma-airs-tools.md)       | `before_tool_call`   | Gates dangerous tools                     |

### Detection Capabilities

Powered by Prisma AIRS (configured in SCM):

- **Prompt Injection** - Attempts to override agent instructions
- **Data Leakage** - PII, credentials, sensitive data (DLP)
- **Malicious URLs** - Phishing, malware, disallowed categories
- **Toxic Content** - Harmful, abusive, inappropriate content
- **Malicious Code** - Malware, exploits, dangerous code
- **AI Agent Threats** - Multi-step manipulation attacks
- **Database Security** - SQL injection, dangerous queries
- **Grounding Violations** - Hallucinations, unverified claims
- **Custom Topics** - Organization-specific policy violations

### DLP Masking

Instead of blocking responses with sensitive data, mask them:

```
Before: "Your SSN is 123-45-6789"
After:  "Your SSN is [SSN REDACTED]"
```

### Tool Gating

Block dangerous tools during active threats:

```
Threat: prompt_injection
Blocked: exec, Bash, gateway, message, cron
```

## Requirements

- Node.js 18+
- OpenClaw v2026.2.1+
- Prisma AIRS API key from [Strata Cloud Manager](https://docs.paloaltonetworks.com/ai-runtime-security)

## Links

- [Prisma AIRS Documentation](https://docs.paloaltonetworks.com/ai-runtime-security)
- [API Reference](https://pan.dev/prisma-airs/)
- [GitHub Repository](https://github.com/cdot65/prisma-airs-plugin-openclaw)
- [npm Package](https://www.npmjs.com/package/@cdot65/prisma-airs)
