# Installation

## Requirements

- **Node.js 18+** (`engines.node >= 18.0.0`)
- **OpenClaw v2026.2.1+** — compatible gateway version
- **Prisma AIRS API Key** — obtained from [Strata Cloud Manager](https://stratacloudmanager.paloaltonetworks.com)

## Install from npm

```bash
openclaw plugins install @cdot65/prisma-airs
```

The plugin ships as ESM (`"type": "module"`) with a single runtime dependency:

| Dependency                | Purpose                        |
| ------------------------- | ------------------------------ |
| `@cdot65/prisma-airs-sdk` | AIRS API communication (HTTP, auth, retries) |

## Install from Source

For development or testing:

```bash
# Clone the repository
git clone https://github.com/cdot65/prisma-airs-plugin-openclaw.git
cd prisma-airs-plugin-openclaw/prisma-airs-plugin

# Install dependencies
npm install

# Install to OpenClaw
openclaw plugins install .
```

## API Key Setup

1. Log in to [Strata Cloud Manager](https://stratacloudmanager.paloaltonetworks.com)
2. Navigate to **Settings** > **Access Keys**
3. Create a new access key with AI Security permissions
4. Set the API key in plugin config (via gateway web UI or YAML config file):

```yaml
plugins:
  prisma-airs:
    config:
      api_key: "your-api-key"
```

!!! tip "Web UI"
    The API key field is marked as sensitive in the gateway web UI — it will be hidden after entry.

## Restart Gateway

After installation:

```bash
openclaw gateway restart
```

## Verify Installation

Run the `prisma-airs` CLI command to check plugin status:

```bash
openclaw prisma-airs
```

Expected output:

```
Prisma AIRS Plugin Status
-------------------------
Version: 1.0.0
Profile: default
App Name: openclaw
Modes:
  Reminder: on
  Audit: deterministic
  Context: deterministic
  Outbound: deterministic
  Tool Gating: deterministic
API Key: configured
```

!!! note "Version"
    The current plugin version is **1.0.0**. If you see an older version, reinstall from npm.

You can also list installed plugins:

```bash
openclaw plugins list | grep prisma
```

## Troubleshooting

### Plugin Not Found

```bash
openclaw plugins uninstall prisma-airs
openclaw plugins install @cdot65/prisma-airs
openclaw gateway restart
```

### API Key Not Configured

```bash
openclaw prisma-airs
# Should show: API Key: MISSING
```

If missing, set `api_key` in plugin config via the gateway web UI or YAML config file.

### Connection Errors

Verify network access to the AIRS API endpoint:

```bash
curl -I https://service.api.aisecurity.paloaltonetworks.com/v1/scan/sync/request
```

!!! warning "Fail Closed"
    By default `fail_closed: true` — if the AIRS API is unreachable, all blocking hooks will reject messages. Set `fail_closed: false` to allow messages through on API failure (not recommended for production).
