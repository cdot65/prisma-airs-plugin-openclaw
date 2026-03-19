# prisma-airs-tools

Cache-based tool gating that blocks dangerous tool calls when security threats are active.

## Overview

| Field | Value |
|-------|-------|
| Event | `before_tool_call` |
| Config field | `tool_gating_mode` |
| Can Block | Yes (`{ block: true, blockReason }`) |
| Default mode | `deterministic` |
| Valid modes | `deterministic`, `probabilistic`, `off` |

## Purpose

Uses cached scan results from inbound scanning to selectively block tool calls. Different threat categories block different tool sets. If any threat is detected, high-risk tools are always blocked.

This hook does NOT call the AIRS API. It relies entirely on the scan cache populated by `prisma-airs-audit` or `prisma-airs-context`.

## How It Works

1. Reads `tool_gating_mode` from config (default: `deterministic`). Returns void if `off`.
2. Validates `event.toolName` exists.
3. Builds session key from `ctx.sessionKey` or `ctx.conversationId`.
4. Reads cached scan result via `getCachedScanResult(sessionKey)`. If no cache entry, allows through.
5. If cached result is safe (`action: "allow"` and severity `SAFE` or all categories safe/benign), allows through.
6. Calls `shouldBlockTool(toolName, scanResult, highRiskTools)` to check if this tool should be blocked.
7. If blocked, returns `{ block: true, blockReason: "Tool '<name>' blocked due to security threat: <categories>. Scan ID: <id>" }`.
8. If allowed despite active warning, logs an audit entry.

### Tool Category Mappings

Each threat category maps to a set of tools that should be blocked:

| Category | Blocked Tools |
|----------|--------------|
| `agent-threat`, `agent_threat`, `agent_threat_prompt`, `agent_threat_response` | `ALL_EXTERNAL_TOOLS` |
| `sql-injection`, `db_security`, `db-security`, `db_security_response` | `DB_TOOLS` |
| `malicious-code`, `malicious_code`, `malicious_code_prompt`, `malicious_code_response` | `CODE_TOOLS` |
| `prompt-injection`, `prompt_injection` | `SENSITIVE_TOOLS` |
| `malicious-url`, `malicious_url`, `url_filtering_prompt`, `url_filtering_response` | `WEB_TOOLS` |
| `toxic_content`, `toxic_content_prompt`, `toxic_content_response` | `CODE_TOOLS` |
| `topic_violation`, `topic_violation_prompt`, `topic_violation_response` | `SENSITIVE_TOOLS` |
| `scan-failure` | `SENSITIVE_TOOLS` + `write`, `Write`, `edit`, `Edit` |

### Tool Sets

| Set | Tools |
|-----|-------|
| `ALL_EXTERNAL_TOOLS` | `exec`, `Bash`, `bash`, `write`, `Write`, `edit`, `Edit`, `gateway`, `message`, `cron`, `browser`, `web_fetch`, `WebFetch`, `database`, `query`, `sql`, `eval`, `NotebookEdit` |
| `DB_TOOLS` | `exec`, `Bash`, `bash`, `database`, `query`, `sql`, `eval` |
| `CODE_TOOLS` | `exec`, `Bash`, `bash`, `write`, `Write`, `edit`, `Edit`, `eval`, `NotebookEdit` |
| `SENSITIVE_TOOLS` | `exec`, `Bash`, `bash`, `gateway`, `message`, `cron` |
| `WEB_TOOLS` | `web_fetch`, `WebFetch`, `browser`, `Browser`, `curl` |

### Default High-Risk Tools

When ANY threat is detected (action is `block` or `warn`, or categories contain non-safe entries), these tools are always blocked:

`exec`, `Bash`, `bash`, `write`, `Write`, `edit`, `Edit`, `gateway`, `message`, `cron`

### Custom High-Risk Tools

Override the default list via `high_risk_tools` config:

```yaml
high_risk_tools:
  - exec
  - Bash
  - database
```

### Tool Name Matching

Tool names are compared case-insensitively (both tool name and blocked list are lowercased).

## Configuration

```yaml
plugins:
  entries:
    prisma-airs:
      config:
        tool_gating_mode: "deterministic"  # "deterministic" | "probabilistic" | "off"
        high_risk_tools:                    # optional override
          - exec
          - Bash
          - bash
          - write
          - Write
          - edit
          - Edit
          - gateway
          - message
          - cron
```

## Behavior

| Condition | Result |
|-----------|--------|
| `tool_gating_mode` = `off` | No-op |
| No `toolName` in event | No-op |
| No cached scan result | Allow through |
| Cached result is safe | Allow through |
| Tool in blocked set for detected category | Block with reason |
| Tool in high-risk set + any threat detected | Block with reason |
| Tool not in any blocked set | Allow (log if warning active) |

## Related Hooks

- [prisma-airs-audit](prisma-airs-audit.md) -- Populates the scan cache this hook reads.
- [prisma-airs-context](prisma-airs-context.md) -- Also populates cache on fallback scan.
- [prisma-airs-tool-guard](prisma-airs-tool-guard.md) -- Complementary hook that actively scans tool inputs (not cache-based).
