#!/usr/bin/env bash
# Auto-approve all pending device pairing requests by watching the pending.json file.
# Runs as a background process in the Docker entrypoint.
# Uses the gateway RPC via openclaw CLI with --latest flag.
set -u

TOKEN="${GATEWAY_TOKEN:-e2e-dev-token}"
PENDING="/home/node/.openclaw/devices/pending.json"

echo "[auto-pair] Waiting for gateway to accept connections..."
for i in $(seq 1 60); do
  if curl -sf http://localhost:18789/__openclaw__/canvas/ > /dev/null 2>&1; then
    echo "[auto-pair] Gateway is up. Starting auto-approve watcher."
    break
  fi
  sleep 2
done

# Poll pending.json directly — much faster than the CLI
while true; do
  if [ -f "$PENDING" ] && [ -s "$PENDING" ]; then
    # Check if there are actual entries (not just {})
    ENTRY_COUNT=$(node -e "
      const fs = require('fs');
      try {
        const p = JSON.parse(fs.readFileSync('$PENDING', 'utf8'));
        console.log(Object.keys(p).length);
      } catch { console.log(0); }
    " 2>/dev/null)

    if [ "$ENTRY_COUNT" -gt 0 ] 2>/dev/null; then
      echo "[auto-pair] Found $ENTRY_COUNT pending request(s). Approving..."
      # Use the CLI to approve — it handles the WebSocket handshake correctly
      timeout 30 openclaw devices approve --latest --token "$TOKEN" --timeout 15000 2>&1 | \
        grep -v '^\[plugins\]' | grep -v '^$' || true
      echo "[auto-pair] Approve attempt completed."
    fi
  fi
  sleep 2
done
