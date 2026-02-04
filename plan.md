# Plan: Fix Prisma AIRS Plugin Tool Registration

## Problem Summary

The `@cdot65/prisma-airs` plugin's agent tool `prisma_airs_scan` is broken after OpenClaw v2026.2.1.

**Error:** `tool.execute is not a function`

**Root Cause:** OpenClaw v2026.2.1 aligned tool execute adapters/signatures. The plugin uses the old `handler` API instead of the new `execute` API.

**Breaking Change (v2026.2.1):** https://github.com/openclaw/openclaw/releases/tag/v2026.2.1
> Tools: align tool execute adapters/signatures (legacy + parameter order + arg normalization).

**Current Latest:** v2026.2.2 (recommended upgrade target)

---

## OpenClaw Version Context

### v2026.2.1 (Breaking Change)
- Tool signature alignment (`handler` → `execute`)
- This broke the prisma-airs plugin

### v2026.2.2 (Current Latest - Recommended)
- **Agents:** repair malformed tool calls and session transcripts (#7473)
- **Security:** Multiple hardening fixes:
  - Require `operator.approvals` for gateway `/approve` commands
  - Guard skill installer downloads with SSRF checks
  - Harden Windows exec allowlist
  - Token-gate voice-call media streams
  - Apply SSRF guardrails to media provider fetches
- **New Features:**
  - Web UI Agents dashboard for managing agent files, tools, skills, models, channels, cron jobs
  - QMD memory backend (opt-in)
  - Feishu/Lark plugin support
  - Default subagent thinking level config (`agents.defaults.subagents.thinking`)

**Upgrade to v2026.2.2** for the security fixes and improved tool call handling.

---

## Files to Modify

### 1. `/home/node/.openclaw/extensions/prisma-airs/index.ts`

#### Current Code (broken)
```typescript
api.registerTool({
  name: "prisma_airs_scan",
  description: "...",
  parameters: {
    type: "object",
    properties: { /* ... */ },
    required: ["prompt"],
  },
  handler: async (params: ScanRequest): Promise<ScanResult> => {
    const cfg = getPluginConfig(api);
    const request = buildScanRequest(params, cfg);
    return scan(request);
  },
});
```

#### Fixed Code
```typescript
api.registerTool({
  name: "prisma_airs_scan",
  description: "...",
  parameters: {
    type: "object",
    properties: { /* ... */ },
    required: ["prompt"],
  },
  async execute(_id: string, params: ScanRequest) {
    const cfg = getPluginConfig(api);
    const request = buildScanRequest(params, cfg);
    const result = await scan(request);
    
    // Return in OpenClaw tool result format
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  },
});
```

#### Changes Summary
| Aspect | Before | After |
|--------|--------|-------|
| Method name | `handler` | `execute` |
| Signature | `(params)` | `(_id, params)` |
| Return type | Raw `ScanResult` | `{ content: [{ type: "text", text: string }] }` |

---

## Implementation Steps

### Step 1: Update the Tool Registration

1. Open `/home/node/.openclaw/extensions/prisma-airs/index.ts`
2. Find the `api.registerTool({` block (around line 95)
3. Replace `handler:` with `execute:`
4. Add `_id: string` as the first parameter
5. Wrap the return value in the tool result format

### Step 2: Update TypeScript Types (if needed)

Add or update the tool result type:
```typescript
interface ToolResult {
  content: Array<{
    type: "text";
    text: string;
  }>;
}
```

### Step 3: Bump Version

Update `package.json`:
```json
{
  "version": "0.1.4"
}
```

---

## Validation Steps

### Run Existing Tests
```bash
cd /home/node/.openclaw/extensions/prisma-airs
npm test
```

### Manual CLI Test (should still work)
```bash
openclaw prisma-airs-scan "test prompt"
```

### Manual Agent Tool Test
After restarting the gateway, test via agent:
1. Ask the agent to scan a prompt
2. Verify no `tool.execute is not a function` error
3. Verify scan results are returned properly

### Test the WildFire URL
```bash
# Via CLI
openclaw prisma-airs-scan "scan this url https://wildfire.paloaltonetworks.com/publicapi/test/pe"

# Via agent tool (after fix)
# Should return threat detection for the known-malicious test URL
```

---

## Gateway & Node Upgrade Steps

### Step 1: Check Current Version
```bash
openclaw --version
openclaw status
```

### Step 2: Update OpenClaw to v2026.2.2
```bash
# Interactive update (recommended)
openclaw update

# Or manually with pnpm (configured in this install)
pnpm update -g openclaw

# Or with npm
npm update -g openclaw
```

### Step 3: Verify Update
```bash
openclaw --version
# Should show: openclaw 2026.2.2
```

### Step 4: Restart Gateway
```bash
# If running as systemd service
openclaw gateway restart

# If running in Docker/K8s
# Restart the pod/container (new image or recreate)

# If running manually
# Ctrl+C to stop, then:
openclaw gateway start
```

### Step 5: Update Nodes (if applicable)
```bash
# List connected nodes
openclaw nodes status

# Nodes auto-update on reconnect, or manually SSH to each node:
ssh <node>
openclaw update
```

### Step 6: Final Verification
```bash
# Check gateway status
openclaw status

# Verify plugin loaded
openclaw prisma-airs

# Test the agent tool (after plugin fix is applied)
# The tool should now work without "tool.execute is not a function" error
```

---

## Reference Documentation

- **OpenClaw Plugin Agent Tools:** `/usr/local/lib/node_modules/openclaw/docs/plugins/agent-tools.md`
- **v2026.2.1 Release Notes (breaking change):** https://github.com/openclaw/openclaw/releases/tag/v2026.2.1
- **v2026.2.2 Release Notes (current):** https://github.com/openclaw/openclaw/releases/tag/v2026.2.2
- **Plugin Source:** https://github.com/cdot65/prisma-airs-plugin-openclaw

---

## Post-Fix Checklist

### Plugin Fix
- [ ] `handler` renamed to `execute`
- [ ] First parameter `_id: string` added
- [ ] Return format wrapped in `{ content: [{ type: "text", text: ... }] }`
- [ ] Version bumped to `0.1.4` in `package.json`
- [ ] Tests pass (`npm test`)
- [ ] CLI scan works (`openclaw prisma-airs-scan "test"`)
- [ ] Agent tool works (no `tool.execute is not a function` error)
- [ ] Changes committed and pushed to repo

### Infrastructure
- [ ] OpenClaw updated to v2026.2.2
- [ ] Gateway restarted
- [ ] Nodes updated (if applicable)
- [ ] `openclaw status` shows healthy
- [ ] `openclaw prisma-airs` shows plugin loaded
