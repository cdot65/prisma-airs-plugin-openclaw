# Installation

## Prerequisites

- **Node.js 18+** - Required for the plugin runtime
- **OpenClaw v2026.2.1+** - Compatible gateway version
- **Prisma AIRS API Key** - Obtained from Strata Cloud Manager

## Install from npm

The recommended installation method:

```bash
openclaw plugins install @cdot65/prisma-airs
```

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
2. Navigate to **Settings** → **Access Keys**
3. Create a new access key with AI Security permissions
4. Set the API key in plugin config (via gateway web UI or config file):

```yaml
plugins:
  prisma-airs:
    config:
      api_key: "your-api-key"
```

## Restart Gateway

After installation:

```bash
openclaw gateway restart
```

## Verify Installation

```bash
# Check plugin loaded
openclaw plugins list | grep prisma

# Check status
openclaw prisma-airs

# Test scan
openclaw prisma-airs-scan "hello world"
```

Expected output:

```
Prisma AIRS Plugin Status
-------------------------
Version: 0.2.4
Profile: default
App Name: openclaw
Reminder: true
API Key: configured
```

## Troubleshooting

### Plugin not found

```bash
# Reinstall
openclaw plugins uninstall prisma-airs
openclaw plugins install @cdot65/prisma-airs
openclaw gateway restart
```

### API Key not configured

```bash
# Check status
openclaw prisma-airs
# Should show: API Key: MISSING
# Set it in plugin config via gateway web UI or config file
```

### Connection errors

Verify network access to the AIRS API:

```bash
curl -I https://service.api.aisecurity.paloaltonetworks.com/v1/scan/sync/request
```
