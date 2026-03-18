#!/usr/bin/env bash
set -e

PLUGIN_DIR="/home/node/workspace/skills/prisma-airs-plugin"
SEED_CONFIG="/home/node/openclaw-seed.json"
LIVE_CONFIG="/home/node/.openclaw/openclaw.json"

# Seed OpenClaw config into the persistent volume on first run
if [ -f "$SEED_CONFIG" ] && [ ! -f "$LIVE_CONFIG" ]; then
  echo "[entrypoint] Seeding OpenClaw config into persistent volume..."
  cp "$SEED_CONFIG" "$LIVE_CONFIG"
fi

# Install plugin deps if node_modules missing (first run or volume mount)
if [ -d "$PLUGIN_DIR" ] && [ ! -d "$PLUGIN_DIR/node_modules" ]; then
  echo "[entrypoint] Installing plugin dependencies..."
  cd "$PLUGIN_DIR" && npm ci --ignore-scripts
  cd /home/node
fi

# Inject AIRS config into plugin config if provided via env vars
if [ -n "$PANW_AI_SEC_API_KEY" ]; then
  echo "[entrypoint] Setting Prisma AIRS config from environment..."
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
