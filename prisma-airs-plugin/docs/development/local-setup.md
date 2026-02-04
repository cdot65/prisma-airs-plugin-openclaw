# Local Setup

Set up the plugin for local development and testing.

## Prerequisites

- Node.js 18+
- npm
- OpenClaw CLI installed
- Prisma AIRS API key (for live testing)

## Clone and Install

```bash
# Clone repository
git clone https://github.com/cdot65/prisma-airs-plugin-openclaw.git
cd prisma-airs-plugin-openclaw/prisma-airs-plugin

# Install dependencies
npm install
```

## Development Commands

```bash
# Type checking
npm run typecheck

# Linting
npm run lint
npm run lint:fix

# Formatting
npm run format
npm run format:check

# Tests
npm test
npm run test:watch
npm run test:coverage

# Full check suite
npm run check
```

## Install to OpenClaw

### From Local Directory

```bash
# Build and install
openclaw plugins install .

# Restart gateway
openclaw gateway restart
```

### Verify Installation

```bash
# Check plugin loaded
openclaw plugins list | grep prisma

# Check status (will show missing API key)
openclaw prisma-airs
```

## Configure API Key

### Environment Variable

```bash
export PANW_AI_SEC_API_KEY="your-api-key"
```

### For Gateway Service

=== "Linux (systemd)"

    ```bash
    mkdir -p ~/.config/systemd/user/openclaw-gateway.service.d
    cat > ~/.config/systemd/user/openclaw-gateway.service.d/env.conf << 'EOF'
    [Service]
    Environment=PANW_AI_SEC_API_KEY=your-key
    EOF
    systemctl --user daemon-reload
    openclaw gateway restart
    ```

=== "macOS"

    Add to your shell profile (`~/.zshrc` or `~/.bash_profile`):
    ```bash
    export PANW_AI_SEC_API_KEY="your-key"
    ```

## Test the Plugin

### CLI Scan

```bash
openclaw prisma-airs-scan "test message"
```

### RPC Call

```bash
openclaw gateway call prisma-airs.scan --params '{"prompt":"test"}'
```

### Check Status

```bash
openclaw prisma-airs
```

Expected output:

```
Prisma AIRS Plugin Status
-------------------------
Version: 0.2.0
Profile: default
App Name: openclaw
Reminder: true
API Key: configured
```

## Development Workflow

### 1. Make Changes

Edit files in `prisma-airs-plugin/`.

### 2. Run Tests

```bash
npm test
```

### 3. Reinstall Plugin

```bash
openclaw plugins uninstall prisma-airs
openclaw plugins install .
openclaw gateway restart
```

### 4. Test Changes

```bash
openclaw prisma-airs-scan "test your changes"
```

## Debugging

### View Gateway Logs

```bash
# macOS/Linux
tail -f ~/.openclaw/logs/gateway.log

# Or use OpenClaw CLI
openclaw gateway logs
```

### Enable Debug Logging

Set log level in OpenClaw config:

```yaml
logging:
  level: debug
```

### Test Hook Output

Hooks log to console:

```bash
# View hook audit logs
grep "prisma_airs" ~/.openclaw/logs/gateway.log
```

## Testing Without API Key

For unit tests, the API is mocked. For manual testing without an API key:

```bash
# Will return error response
openclaw prisma-airs-scan "test"

# Expected output
[--] LOW
Action: warn
Categories: api_error
Error: PANW_AI_SEC_API_KEY not set
```

## Project Structure

```
prisma-airs-plugin-openclaw/
├── prisma-airs-plugin/      # Plugin source
│   ├── index.ts             # Plugin entrypoint
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   ├── src/                 # Core modules
│   │   ├── scanner.ts
│   │   └── scan-cache.ts
│   ├── hooks/               # Hook handlers
│   │   ├── prisma-airs-guard/
│   │   ├── prisma-airs-audit/
│   │   ├── prisma-airs-context/
│   │   ├── prisma-airs-outbound/
│   │   └── prisma-airs-tools/
│   └── docs/                # Documentation
├── README.md
├── RELEASE_NOTES.md
└── .github/workflows/       # CI/CD
```

## Common Issues

### Plugin Not Loading

```bash
# Check for errors
openclaw plugins list

# Reinstall
openclaw plugins uninstall prisma-airs
openclaw plugins install .
openclaw gateway restart
```

### TypeScript Errors

```bash
# Run type check
npm run typecheck

# Fix common issues
npm run lint:fix
```

### Tests Failing

```bash
# Run with verbose output
npm test -- --reporter=verbose

# Run specific test
npm test -- --filter "test name"
```

### API Key Not Working

```bash
# Verify key is set
echo $PANW_AI_SEC_API_KEY

# Check gateway has key
openclaw prisma-airs
# Should show: API Key: configured

# Test directly
curl -X POST \
  -H "x-pan-token: $PANW_AI_SEC_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"ai_profile":{"profile_name":"default"},"contents":[{"prompt":"test"}]}' \
  https://service.api.aisecurity.paloaltonetworks.com/v1/scan/sync/request
```
