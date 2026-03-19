# Docker Deployment

Run OpenClaw with the Prisma AIRS plugin in Docker using the provided E2E infrastructure.

## Prerequisites

- Docker and Docker Compose
- A Prisma AIRS API key from Strata Cloud Manager

## Architecture

The Docker setup consists of:

- `docker/Dockerfile.e2e` -- builds the OpenClaw gateway image with Python 3.12 and Node.js 22
- `docker/entrypoint.sh` -- installs plugin deps, injects API key from env vars
- `docker/openclaw-e2e.json` -- seed config with plugin path and auth token
- `docker-compose.yml` -- service definition with volume mounts
- `e2e/smoke-test.sh` -- E2E test script

## Dockerfile

The `docker/Dockerfile.e2e` builds a complete OpenClaw gateway:

```dockerfile
FROM python:3.12-slim

# Install system dependencies + Node.js 22
RUN apt-get update && apt-get install -y \
    git \
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install openclaw CLI globally
RUN npm install -g openclaw@latest

# Create non-root user with standard directories
RUN useradd -m -u 1000 node && \
    mkdir -p /home/node/.openclaw /home/node/workspace/skills && \
    chown -R node:node /home/node

# Install uv for node user
USER node
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/home/node/.local/bin:$PATH"

WORKDIR /home/node

# Seed OpenClaw config, E2E tests, and entrypoint
COPY --chown=node:node docker/openclaw-e2e.json /home/node/openclaw-seed.json
COPY --chown=node:node e2e /home/node/e2e
RUN chmod +x /home/node/e2e/*.sh
COPY --chown=node:node docker/entrypoint.sh /home/node/entrypoint.sh
RUN chmod +x /home/node/entrypoint.sh

ENTRYPOINT ["/home/node/entrypoint.sh"]
CMD ["openclaw", "gateway", "run", "--port", "18789", "--bind", "lan", "--allow-unconfigured"]
```

## Entrypoint

The `docker/entrypoint.sh` handles first-run setup:

1. Seeds the OpenClaw config from `openclaw-seed.json` into the persistent volume (if not already present)
2. Runs `npm ci --ignore-scripts` in the plugin directory (if `node_modules` missing)
3. Injects `PANW_AI_SEC_API_KEY` and `PANW_AI_SEC_PROFILE` env vars into the live config

```bash
#!/usr/bin/env bash
set -e

PLUGIN_DIR="/home/node/workspace/skills/prisma-airs-plugin"
SEED_CONFIG="/home/node/openclaw-seed.json"
LIVE_CONFIG="/home/node/.openclaw/openclaw.json"

# Seed config on first run
if [ -f "$SEED_CONFIG" ] && [ ! -f "$LIVE_CONFIG" ]; then
  cp "$SEED_CONFIG" "$LIVE_CONFIG"
fi

# Install plugin deps if needed
if [ -d "$PLUGIN_DIR" ] && [ ! -d "$PLUGIN_DIR/node_modules" ]; then
  cd "$PLUGIN_DIR" && npm ci --ignore-scripts
  cd /home/node
fi

# Inject AIRS config from env vars
if [ -n "$PANW_AI_SEC_API_KEY" ]; then
  node -e "
    const fs = require('fs');
    const cfg = JSON.parse(fs.readFileSync(process.env.LIVE_CONFIG, 'utf8'));
    const entry = cfg.plugins?.entries?.['prisma-airs'] ?? {};
    entry.config = entry.config || {};
    entry.config.api_key = process.env.PANW_AI_SEC_API_KEY;
    if (process.env.PANW_AI_SEC_PROFILE) {
      entry.config.profile_name = process.env.PANW_AI_SEC_PROFILE;
    }
    cfg.plugins.entries['prisma-airs'] = entry;
    fs.writeFileSync(process.env.LIVE_CONFIG, JSON.stringify(cfg, null, 2) + '\n');
  "
fi

exec "$@"
```

## docker-compose.yml

```yaml
services:
  gateway:
    build:
      context: .
      dockerfile: docker/Dockerfile.e2e
    ports:
      - "18789:18789"
    environment:
      - PANW_AI_SEC_API_KEY=${PANW_AI_SEC_API_KEY:-}
      - PANW_AI_SEC_PROFILE=${PANW_AI_SEC_PROFILE:-}
      - LIVE_CONFIG=/home/node/.openclaw/openclaw.json
    volumes:
      - openclaw-data:/home/node/.openclaw
      - ./prisma-airs-plugin:/home/node/workspace/skills/prisma-airs-plugin
    init: true
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-sf", "http://localhost:18789/__openclaw__/canvas/"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 30s

volumes:
  openclaw-data:
```

Key details:

- Plugin source is bind-mounted for live development
- `openclaw-data` volume persists config across restarts
- Health check polls the gateway canvas endpoint
- API key passed via environment variable

## Seed Config

The `docker/openclaw-e2e.json` registers the plugin and sets an auth token:

```json
{
  "gateway": {
    "controlUi": {
      "dangerouslyAllowHostHeaderOriginFallback": true
    },
    "auth": {
      "token": "e2e-dev-token"
    }
  },
  "plugins": {
    "load": {
      "paths": ["/home/node/workspace/skills/prisma-airs-plugin"]
    },
    "entries": {
      "prisma-airs": {
        "enabled": true
      }
    },
    "installs": {
      "prisma-airs": {
        "source": "path",
        "sourcePath": "/home/node/workspace/skills/prisma-airs-plugin",
        "installPath": "/home/node/workspace/skills/prisma-airs-plugin",
        "version": "1.0.0"
      }
    }
  }
}
```

## Build and Run

```bash
# Set API key
export PANW_AI_SEC_API_KEY="your-api-key-here"

# Build and start
docker compose up -d --build

# Check logs
docker compose logs -f gateway

# Wait for healthy status
docker compose ps
```

The gateway is ready when the health check passes (port 18789).

## Running Smoke Tests

The `e2e/smoke-test.sh` script runs inside the container:

```bash
docker compose exec gateway bash /home/node/e2e/smoke-test.sh
```

The smoke tests verify:

1. Plugin status is `ready`
2. API key is configured
3. Benign scan returns `allow`
4. Scan returns a `scanId`
5. Scan returns `latencyMs`
6. Injection attempt returns `block` or `warn`
7. Injection scan includes `prompt_injection` category

Expected output:

```
=== Prisma AIRS E2E Smoke Tests ===

[1] Plugin status
  PASS: plugin status=ready
[2] API key configured
  PASS: API key is configured
[3] Benign scan (expect allow)
  PASS: benign message allowed
[4] Scan returns scan ID
  PASS: scan returned scanId=scan_abc123
[5] Scan returns latency
  PASS: latencyMs present in response
[6] Injection detection (expect block)
  PASS: injection detected (action=block)
[7] Injection categories
  PASS: prompt_injection category present

=== Results: 7 passed, 0 failed ===
```

## Stopping

```bash
docker compose down

# Remove persistent volume too
docker compose down -v
```

## Troubleshooting

### Plugin not loading

Check that the plugin source is mounted correctly:

```bash
docker compose exec gateway ls /home/node/workspace/skills/prisma-airs-plugin/node_modules
```

If `node_modules` is missing, restart the container to trigger `npm ci`.

### API key not set

```bash
docker compose exec gateway cat /home/node/.openclaw/openclaw.json | grep api_key
```

Ensure `PANW_AI_SEC_API_KEY` is exported before running `docker compose up`.

### Health check failing

The gateway may take 30+ seconds to start. Check logs:

```bash
docker compose logs gateway | tail -20
```

## Source Files

- `docker-compose.yml`
- `docker/Dockerfile.e2e`
- `docker/entrypoint.sh`
- `docker/openclaw-e2e.json`
- `e2e/smoke-test.sh`
