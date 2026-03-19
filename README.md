# Prisma AIRS Plugin

[![npm version](https://img.shields.io/npm/v/@cdot65/prisma-airs)](https://www.npmjs.com/package/@cdot65/prisma-airs)
[![CI](https://github.com/cdot65/prisma-airs-plugin-openclaw/actions/workflows/ci.yml/badge.svg)](https://github.com/cdot65/prisma-airs-plugin-openclaw/actions/workflows/ci.yml)
[![Documentation](https://img.shields.io/badge/docs-GitHub%20Pages-blue)](https://cdot65.github.io/prisma-airs-plugin-openclaw/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

OpenClaw plugin for [Prisma AIRS](https://www.paloaltonetworks.com/prisma/prisma-ai-runtime-security) (AI Runtime Security) from Palo Alto Networks. Defense-in-depth with 12 security hooks across 9 event types.

**[Documentation](https://cdot65.github.io/prisma-airs-plugin-openclaw/)** | **[npm](https://www.npmjs.com/package/@cdot65/prisma-airs)** | **[Prisma AIRS SDK](https://cdot65.github.io/prisma-airs-sdk/)**

## 12 Security Hooks

| Hook | Event | Can Block |
|------|-------|-----------|
| prisma-airs-inbound-block | `before_message_write` | Yes |
| prisma-airs-outbound-block | `before_message_write` | Yes |
| prisma-airs-outbound | `message_sending` | Yes |
| prisma-airs-tool-guard | `before_tool_call` | Yes |
| prisma-airs-tools | `before_tool_call` | Yes |
| prisma-airs-prompt-scan | `before_prompt_build` | No |
| prisma-airs-tool-redact | `tool_result_persist` | No |
| prisma-airs-context | `before_agent_start` | No |
| prisma-airs-guard | `before_agent_start` | No |
| prisma-airs-audit | `message_received` | No |
| prisma-airs-llm-audit | `llm_input` / `llm_output` | No |
| prisma-airs-tool-audit | `after_tool_call` | No |

## Quick Start

```bash
# Install
openclaw plugins install @cdot65/prisma-airs

# Configure API key (via web UI or config file)
# plugins.entries.prisma-airs.config.api_key = "your-key"

# Restart gateway
openclaw gateway restart

# Verify
openclaw prisma-airs
```

## Plugin Structure

```
prisma-airs-plugin/
├── index.ts                      # Plugin entrypoint (SDK init, RPC, tools, CLI)
├── openclaw.plugin.json          # Manifest (hooks, config schema, UI hints)
├── src/
│   ├── scanner.ts                # SDK adapter (scan, ScanResult, mapScanResponse)
│   ├── config.ts                 # Mode resolution (deterministic/probabilistic/off)
│   └── scan-cache.ts             # TTL cache for cross-hook data sharing
└── hooks/
    ├── prisma-airs-guard/        # Security reminder (before_agent_start)
    ├── prisma-airs-audit/        # Audit logging + caching (message_received)
    ├── prisma-airs-context/      # Threat warning injection (before_agent_start)
    ├── prisma-airs-prompt-scan/  # Full context scanning (before_prompt_build)
    ├── prisma-airs-inbound-block/  # Block user messages (before_message_write)
    ├── prisma-airs-outbound-block/ # Block assistant messages (before_message_write)
    ├── prisma-airs-outbound/     # Block/mask responses (message_sending)
    ├── prisma-airs-tools/        # Cache-based tool gating (before_tool_call)
    ├── prisma-airs-tool-guard/   # Active tool input scanning (before_tool_call)
    ├── prisma-airs-tool-redact/  # DLP redaction of tool outputs (tool_result_persist)
    ├── prisma-airs-llm-audit/    # LLM I/O audit logging (llm_input/llm_output)
    └── prisma-airs-tool-audit/   # Tool output audit logging (after_tool_call)
```

## Detection Capabilities

Powered by Prisma AIRS (configured in Strata Cloud Manager):

- Prompt Injection
- Data Leakage (DLP)
- Malicious URLs
- Toxic Content
- Malicious Code
- AI Agent Threats
- Database Security
- Grounding Violations
- Custom Topics

## Requirements

- Node.js 18+
- OpenClaw v2026.2.1+
- Prisma AIRS API key from [Strata Cloud Manager](https://docs.paloaltonetworks.com/ai-runtime-security)

## Links

- [Full Documentation](https://cdot65.github.io/prisma-airs-plugin-openclaw/)
- [Prisma AIRS Documentation](https://docs.paloaltonetworks.com/ai-runtime-security)
- [AIRS API Reference](https://pan.dev/prisma-airs/)
- [Prisma AIRS SDK](https://cdot65.github.io/prisma-airs-sdk/)

## License

MIT
